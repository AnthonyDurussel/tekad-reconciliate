import { inject, injectable } from "inversify";
import {
  PaymentAccountKindDTO,
  normalizeText,
  type RevolutImportResultDTO,
} from "@repo/models";
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@/shared/domain/errors.js";
import { parseRevolutStatement } from "@/revolut/domain/RevolutStatement.js";
import type {
  IRevolutTransactionRepository,
  RevolutTransactionFilter,
} from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

export type StatementImport = Omit<RevolutImportResultDTO, "matched">;

@injectable()
export class RevolutUseCases {
  constructor(
    @inject(REVOLUT_TYPES.IRevolutTransactionRepository)
    private transactions: IRevolutTransactionRepository,
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private settings: ISettingsRepository,
  ) {}

  list(filter: RevolutTransactionFilter) {
    return this.transactions.list(filter);
  }

  latestTransaction() {
    return this.transactions.latestOccurredAt();
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
   * Importe un relevé Revolut Business (CSV). Une ligne déjà importée (même
   * ID, même compte) est mise à jour — un relevé peut se réimporter, ou
   * chevaucher le précédent. Chaque ligne va au compte de paiement dont le
   * « Compte Revolut » porte le nom de sa colonne « Account », sinon au
   * compte choisi, sinon au seul compte Revolut actif.
   */
  async importStatement(
    content: string,
    paymentAccountId: string | null,
  ): Promise<StatementImport> {
    const { rows, errors } = parseRevolutStatement(content);
    if (!rows.length) {
      throw new ValidationError(errors[0] ?? "aucune transaction lisible");
    }
    const accounts = (await this.settings.listPaymentAccounts()).filter(
      (a) => a.active,
    );
    if (paymentAccountId && !accounts.some((a) => a.id === paymentAccountId)) {
      throw new ValidationError("compte de paiement inconnu ou inactif");
    }
    const revolutAccounts = accounts.filter(
      (a) => a.kind === PaymentAccountKindDTO.REVOLUT,
    );
    const fallback =
      paymentAccountId ??
      (revolutAccounts.length === 1 ? revolutAccounts[0].id : null);
    const byName = new Map(
      accounts
        .filter((a) => a.revolutAccountId)
        .map((a) => [normalizeText(a.revolutAccountId), a.id]),
    );
    const { created, updated } = await this.transactions.upsertMany(
      rows.map((r) => ({
        ...r,
        paymentAccountId:
          byName.get(normalizeText(r.revolutAccountId)) ?? fallback,
      })),
    );
    const days = rows
      .map((r) => r.occurredAt.toISOString().slice(0, 10))
      .sort();
    return {
      rows: rows.length + errors.length,
      created,
      updated,
      errors: errors.slice(0, 50),
      from: days[0] ?? null,
      to: days[days.length - 1] ?? null,
    };
  }
}
