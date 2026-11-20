import { inject, injectable } from "inversify";
import {
  SyncSourceDTO,
  type SyncRunDTO,
  type SyncStatusDTO,
} from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import { dayToDate } from "@/shared/domain/dates.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type { ISyncRunRepository } from "@/sync/application/repositories/ISyncRunRepository.js";
import { SYNC_TYPES } from "@/sync/infrastructure/ioc/types.sync.js";
import type { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import type { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";

/**
 * Les synchronisations, journalisées dans `sync_runs` : inbox bexio →
 * lecture des pièces → transactions Revolut → rapprochement. Une source non
 * configurée répond 409 sans laisser de trace.
 */
@injectable()
export class SyncUseCases {
  constructor(
    @inject(SYNC_TYPES.ISyncRunRepository) private runs: ISyncRunRepository,
    @inject(EXPENSE_TYPES.ExpenseUseCases) private expenses: ExpenseUseCases,
    @inject(REVOLUT_TYPES.RevolutUseCases) private revolut: RevolutUseCases,
  ) {}

  async status(): Promise<SyncStatusDTO> {
    return {
      bexioConfigured: this.expenses.bexioConfigured,
      revolutConfigured: this.revolut.configured,
      extractionConfigured: this.expenses.readerConfigured,
      last: await this.runs.lastBySource(),
    };
  }

  history(limit = 50) {
    return this.runs.list(limit);
  }

  private configured(source: SyncSourceDTO): boolean {
    switch (source) {
      case SyncSourceDTO.BEXIO_INBOX:
        return this.expenses.bexioConfigured;
      case SyncSourceDTO.EXTRACTION:
        return this.expenses.bexioConfigured && this.expenses.readerConfigured;
      case SyncSourceDTO.REVOLUT:
        return this.revolut.configured;
      case SyncSourceDTO.MATCHING:
        return true;
    }
  }

  private async run(
    source: SyncSourceDTO,
    userId: string | null,
    work: () => Promise<number>,
  ): Promise<SyncRunDTO> {
    if (!this.configured(source)) {
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

  revolutSync(userId: string | null, from?: string | null, to?: string | null) {
    const end = to
      ? new Date(dayToDate(to)!.getTime() + 86_400_000)
      : undefined;
    return this.run(SyncSourceDTO.REVOLUT, userId, () =>
      this.revolut.sync(dayToDate(from) ?? undefined, end),
    );
  }

  match(userId: string | null) {
    return this.run(SyncSourceDTO.MATCHING, userId, () =>
      this.expenses.autoMatchAll(),
    );
  }

  /** Tout ce qui est configuré, dans l'ordre. */
  async all(userId: string | null): Promise<SyncRunDTO[]> {
    const results: SyncRunDTO[] = [];
    if (this.configured(SyncSourceDTO.BEXIO_INBOX))
      results.push(await this.bexioInbox(userId));
    if (this.configured(SyncSourceDTO.EXTRACTION))
      results.push(await this.extract(userId));
    if (this.configured(SyncSourceDTO.REVOLUT))
      results.push(await this.revolutSync(userId));
    results.push(await this.match(userId));
    return results;
  }
}
