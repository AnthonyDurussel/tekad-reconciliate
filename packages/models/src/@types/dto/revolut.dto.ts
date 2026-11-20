import type { StatementFormatDTO } from "./settings.dto.js";

/** Transaction Revolut Business (une jambe sur un compte de la société). */
export interface RevolutTransactionDTO {
  id: string;
  revolutId: string;
  revolutAccountId: string;
  paymentAccountId: string | null;
  type: string;
  state: string;
  date: string;
  description: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  merchantCountry: string | null;
  mcc: string | null;
  /** Montant sur le compte (négatif = sortie). */
  amount: number;
  currency: string;
  /** Montant facturé par le commerçant (devise d'origine). */
  billAmount: number | null;
  billCurrency: string | null;
  cardLast4: string | null;
  /** Pièce rapprochée. */
  expenseId: string | null;
  ignored: boolean;
  ignoreReason: string | null;
  /** Sortie qui exige une pièce (`requiresReceipt()`). */
  requiresReceipt: boolean;
}

export interface RevolutTransactionQueryDTO {
  from?: string;
  to?: string;
  /** `missing` : sorties sans pièce ni dispense — les pièces à demander. */
  filter?: "all" | "missing" | "matched" | "ignored";
  search?: string;
}

/**
 * `POST revolut/import` : le relevé CSV d'un compte rapproché par import.
 * `paymentAccountId` : le compte importé — son format de relevé s'applique ;
 * défaut : le seul compte actif rapproché par import. Dans un relevé
 * Revolut Business qui couvre plusieurs comptes, une ligne dont la colonne
 * « Account » nomme un autre compte importé va à celui-ci.
 */
export interface RevolutImportDTO {
  fileName?: string | null;
  content: string;
  paymentAccountId?: string | null;
}

export interface RevolutImportResultDTO {
  /** Lignes lues dans le fichier. */
  rows: number;
  created: number;
  updated: number;
  /** Lignes illisibles, avec la raison (ligne n : …). */
  errors: string[];
  /** Période couverte par le relevé (`YYYY-MM-DD`). */
  from: string | null;
  to: string | null;
  /** Pièces rapprochées automatiquement après l'import. */
  matched: number;
  /** Cartes du relevé ajoutées au compte (forme masquée + libellé). */
  cardsAdded: string[];
  /** Le compte importé et le format lu. */
  paymentAccountId: string;
  paymentAccountName: string;
  format: StatementFormatDTO;
}
