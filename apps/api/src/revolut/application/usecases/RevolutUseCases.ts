import { inject, injectable } from "inversify";
import {
  ReconciliationModeDTO,
  StatementFormatDTO,
  normalizeText,
  type RevolutImportResultDTO,
} from "@repo/models";
import { randomUUID } from "node:crypto";
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@/shared/domain/errors.js";
import {
  parseRevolutStatement,
  type StatementCard,
} from "@/revolut/domain/RevolutStatement.js";
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
   * Importe le relevé CSV d'un compte rapproché par import, dans le format
   * réglé sur ce compte. Une ligne déjà importée (même ID, même compte) est
   * mise à jour — un relevé peut se réimporter, ou chevaucher le précédent.
   * Une ligne dont la colonne « Account » nomme un autre compte importé va
   * à celui-ci (relevé Revolut Business multi-comptes), les autres au compte
   * choisi (défaut : le seul compte importé).
   */
  async importStatement(
    content: string,
    paymentAccountId: string | null,
  ): Promise<StatementImport> {
    const accounts = (await this.settings.listPaymentAccounts()).filter(
      (a) => a.active,
    );
    const imported = accounts.filter(
      (a) => a.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT,
    );
    let target = paymentAccountId
      ? accounts.find((a) => a.id === paymentAccountId)
      : imported.length === 1
        ? imported[0]
        : undefined;
    if (paymentAccountId && !target) {
      throw new ValidationError("compte de paiement inconnu ou inactif");
    }
    if (!target) {
      throw new ValidationError(
        imported.length
          ? "choisissez le compte dont c'est le relevé"
          : "aucun compte n'est rapproché par import de relevé (Comptes et cartes)",
      );
    }
    if (target.reconciliation !== ReconciliationModeDTO.STATEMENT_IMPORT) {
      throw new ValidationError(
        `« ${target.name} » n'est pas rapproché par import de relevé`,
      );
    }
    const format =
      target.statementFormat ?? StatementFormatDTO.REVOLUT_BUSINESS;
    const { rows, errors, cards } = parseRevolutStatement(content, format);
    if (!rows.length) {
      throw new ValidationError(errors[0] ?? "aucune transaction lisible");
    }
    const byName = new Map(
      imported
        .filter((a) => a.revolutAccountId)
        .map((a) => [normalizeText(a.revolutAccountId), a.id]),
    );
    const accountOf = (revolutAccountId: string) =>
      byName.get(normalizeText(revolutAccountId)) ?? target.id;
    const { created, updated } = await this.transactions.upsertMany(
      rows.map((r) => ({
        ...r,
        paymentAccountId: accountOf(r.revolutAccountId),
      })),
    );
    const cardsAdded = await this.addStatementCards(cards, accountOf);
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
      cardsAdded,
      paymentAccountId: target.id,
      paymentAccountName: target.name,
      format,
    };
  }

  /**
   * Les cartes du relevé encore inconnues rejoignent leur compte importé
   * (forme masquée et libellé de Revolut) : les tickets payés avec elles
   * seront classés sur ce compte. Une carte déjà connue — sur n'importe quel
   * compte — n'est pas touchée.
   */
  private async addStatementCards(
    cards: StatementCard[],
    accountOf: (revolutAccountId: string) => string | null,
  ): Promise<string[]> {
    if (!cards.length) return [];
    const accounts = await this.settings.listPaymentAccounts();
    const known = new Set(accounts.flatMap((a) => a.cards.map((c) => c.last4)));
    const added: string[] = [];
    for (const card of cards) {
      if (known.has(card.last4)) continue;
      const account = accounts.find(
        (a) => a.id === accountOf(card.revolutAccountId),
      );
      if (
        !account ||
        account.reconciliation !== ReconciliationModeDTO.STATEMENT_IMPORT
      )
        continue;
      const { expenseCount: _count, ...plain } = account;
      plain.cards = [
        ...plain.cards,
        {
          id: randomUUID(),
          last4: card.last4,
          maskedNumber: card.maskedNumber,
          label: card.label,
          holder: null,
          active: true,
        },
      ];
      account.cards = plain.cards;
      await this.settings.savePaymentAccount(plain, false);
      known.add(card.last4);
      added.push(
        card.label ? `${card.maskedNumber} (${card.label})` : card.maskedNumber,
      );
    }
    return added;
  }
}
