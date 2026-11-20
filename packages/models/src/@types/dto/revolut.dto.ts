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
