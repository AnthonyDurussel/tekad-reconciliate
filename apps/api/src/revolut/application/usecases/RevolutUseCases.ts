import { inject, injectable } from "inversify";
import {
  PaymentAccountKindDTO,
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
    const { rows, errors, cards } = parseRevolutStatement(content);
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
    const accountOf = (revolutAccountId: string) =>
      byName.get(normalizeText(revolutAccountId)) ?? fallback;
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
    };
  }

  /**
   * Les cartes du relevé encore inconnues rejoignent leur compte Revolut
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
      if (!account || account.kind !== PaymentAccountKindDTO.REVOLUT) continue;
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
