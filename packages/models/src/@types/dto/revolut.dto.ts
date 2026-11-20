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
 * `POST revolut/import` : le relevé exporté de Revolut Business (CSV, texte).
 * `paymentAccountId` : le compte de paiement des lignes dont le compte
 * Revolut (colonne « Account ») n'est rattaché à aucun ; défaut : le seul
 * compte Revolut actif.
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
  /** Cartes du relevé ajoutées au compte Revolut (forme masquée + libellé). */
  cardsAdded: string[];
}
