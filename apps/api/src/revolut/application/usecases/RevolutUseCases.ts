import { inject, injectable } from "inversify";
import { NotFoundError, InvalidStateError } from "@/shared/domain/errors.js";
import { fromRevolutApi } from "@/revolut/domain/RevolutTransaction.js";
import type { IRevolutGateway } from "@/revolut/application/ports/IRevolutGateway.js";
import type {
  IRevolutTransactionRepository,
  RevolutTransactionFilter,
} from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

/** Marge de relecture : une transaction en attente peut changer quelques jours. */
const OVERLAP_DAYS = 3;
/** Premier passage : 90 jours. */
const FIRST_SYNC_DAYS = 90;

@injectable()
export class RevolutUseCases {
  constructor(
    @inject(REVOLUT_TYPES.IRevolutTransactionRepository)
    private transactions: IRevolutTransactionRepository,
    @inject(REVOLUT_TYPES.IRevolutGateway) private gateway: IRevolutGateway,
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private settings: ISettingsRepository,
  ) {}

  get configured(): boolean {
    return this.gateway.configured;
  }

  list(filter: RevolutTransactionFilter) {
    return this.transactions.list(filter);
  }

  async ignore(id: string, reason: string | null) {
    const tx = await this.transactions.findById(id);
    if (!tx) throw new NotFoundError("Revolut transaction");
    if (tx.expenseId) {
      throw new InvalidStateError("cette transaction a déjà sa pièce");
    }
    await this.transactions.setIgnored(id, true, reason?.trim() || null);
    return (await this.transactions.findById(id))!;
  }

  async restore(id: string) {
    const tx = await this.transactions.findById(id);
    if (!tx) throw new NotFoundError("Revolut transaction");
    await this.transactions.setIgnored(id, false, null);
    return (await this.transactions.findById(id))!;
  }

  /**
   * Relit les transactions Revolut de la période (défaut : depuis la
   * dernière lue, avec une marge) et rattache chaque compte Revolut à son
   * compte de paiement. Rend le nombre de lignes nouvelles.
   */
  async sync(from?: Date, to?: Date, now = new Date()): Promise<number> {
    const latest = await this.transactions.latestOccurredAt();
    const start =
      from ??
      new Date(
        (latest?.getTime() ?? now.getTime() - FIRST_SYNC_DAYS * 86_400_000) -
          OVERLAP_DAYS * 86_400_000,
      );
    const api = await this.gateway.listTransactions(start, to ?? now);
    const created = await this.transactions.upsertMany(
      api.flatMap(fromRevolutApi),
    );
    const accounts = await this.settings.listPaymentAccounts();
    await this.transactions.linkPaymentAccounts(
      new Map(
        accounts
          .filter((a) => a.revolutAccountId)
          .map((a) => [a.revolutAccountId!, a.id]),
      ),
    );
    return created;
  }
}
