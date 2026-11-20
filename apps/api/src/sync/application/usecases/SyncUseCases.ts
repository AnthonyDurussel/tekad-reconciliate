import { inject, injectable } from "inversify";
import {
  SyncSourceDTO,
  type RevolutImportDTO,
  type RevolutImportResultDTO,
  type SyncRunDTO,
  type SyncStatusDTO,
} from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type { ISyncRunRepository } from "@/sync/application/repositories/ISyncRunRepository.js";
import { SYNC_TYPES } from "@/sync/infrastructure/ioc/types.sync.js";
import type { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import type { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import type { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

/**
 * Les synchronisations, journalisées dans `sync_runs` : inbox bexio →
 * lecture des pièces → rapprochement, et l'import des relevés Revolut
 * (fichier exporté de Revolut Business, l'abonnement n'ouvrant pas l'API).
 * Une source non configurée répond 409 sans laisser de trace.
 */
@injectable()
export class SyncUseCases {
  constructor(
    @inject(SYNC_TYPES.ISyncRunRepository) private runs: ISyncRunRepository,
    @inject(EXPENSE_TYPES.ExpenseUseCases) private expenses: ExpenseUseCases,
    @inject(REVOLUT_TYPES.RevolutUseCases) private revolut: RevolutUseCases,
    @inject(BEXIO_EXPENSE_TYPES.BexioExpenseUseCases)
    private bexioExpenses: BexioExpenseUseCases,
  ) {}

  async status(): Promise<SyncStatusDTO> {
    return {
      bexioConfigured: this.expenses.bexioConfigured,
      extractionConfigured: await this.expenses.readerConfigured(),
      revolutLatestTransaction:
        (await this.revolut.latestTransaction())?.toISOString() ?? null,
      last: await this.runs.lastBySource(),
    };
  }

  history(limit = 50) {
    return this.runs.list(limit);
  }

  private async configured(source: SyncSourceDTO): Promise<boolean> {
    switch (source) {
      case SyncSourceDTO.BEXIO_INBOX:
      case SyncSourceDTO.BEXIO_EXPENSES:
        return this.expenses.bexioConfigured;
      case SyncSourceDTO.EXTRACTION:
        return (
          this.expenses.bexioConfigured &&
          (await this.expenses.readerConfigured())
        );
      case SyncSourceDTO.REVOLUT:
      case SyncSourceDTO.MATCHING:
        return true;
    }
  }

  private async run(
    source: SyncSourceDTO,
    userId: string | null,
    work: () => Promise<number>,
  ): Promise<SyncRunDTO> {
    if (!(await this.configured(source))) {
      throw new ConflictError(`${source} : non configuré`);
    }
    const id = await this.runs.start(source, userId);
    try {
      const count = await work();
      return await this.runs.finish(id, true, count, null);
    } catch (error) {
      log.error(`[sync] ${source}`, error);
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "échec";
      return this.runs.finish(id, false, 0, message);
    }
  }

  bexioInbox(userId: string | null) {
    return this.run(SyncSourceDTO.BEXIO_INBOX, userId, () =>
      this.expenses.importInbox(),
    );
  }

  extract(userId: string | null) {
    return this.run(SyncSourceDTO.EXTRACTION, userId, () =>
      this.expenses.extractPending(),
    );
  }

  /**
   * Importe un relevé Revolut puis rapproche les pièces en attente. Un
   * fichier illisible répond 400 (rien n'est journalisé).
   */
  async revolutImport(
    userId: string | null,
    input: RevolutImportDTO,
  ): Promise<RevolutImportResultDTO> {
    const id = await this.runs.start(SyncSourceDTO.REVOLUT, userId);
    try {
      const result = await this.revolut.importStatement(
        input.content,
        input.paymentAccountId ?? null,
      );
      const matched = await this.expenses.autoMatchAll();
      await this.runs.finish(
        id,
        true,
        result.created,
        [
          input.fileName,
          `${result.created} nouvelle(s), ${result.updated} mise(s) à jour`,
          result.from && `du ${result.from} au ${result.to}`,
          `${matched} pièce(s) rapprochée(s)`,
          result.errors.length &&
            `${result.errors.length} ligne(s) illisible(s)`,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      return { ...result, matched };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "échec";
      await this.runs.finish(id, false, 0, message);
      throw error;
    }
  }

  /** Relit les dépenses bexio et lie les pièces jointes. */
  bexioExpensesSync(userId: string | null) {
    return this.run(SyncSourceDTO.BEXIO_EXPENSES, userId, () =>
      this.bexioExpenses.sync(),
    );
  }

  match(userId: string | null) {
    return this.run(SyncSourceDTO.MATCHING, userId, () =>
      this.expenses.autoMatchAll(),
    );
  }

  /** Tout ce qui est configuré, dans l'ordre (le relevé Revolut s'importe à part). */
  async all(userId: string | null): Promise<SyncRunDTO[]> {
    const results: SyncRunDTO[] = [];
    if (await this.configured(SyncSourceDTO.BEXIO_INBOX))
      results.push(await this.bexioInbox(userId));
    if (await this.configured(SyncSourceDTO.EXTRACTION))
      results.push(await this.extract(userId));
    results.push(await this.match(userId));
    if (await this.configured(SyncSourceDTO.BEXIO_EXPENSES))
      results.push(await this.bexioExpensesSync(userId));
    return results;
  }
}
