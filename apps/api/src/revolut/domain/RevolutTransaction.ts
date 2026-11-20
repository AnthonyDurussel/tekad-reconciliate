export interface RevolutTransactionProps {
  id: string;
  revolutId: string;
  legId: string;
  revolutAccountId: string;
  paymentAccountId: string | null;
  type: string;
  state: string;
  occurredAt: Date;
  description: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  merchantCountry: string | null;
  mcc: string | null;
  amount: number;
  currency: string;
  billAmount: number | null;
  billCurrency: string | null;
  cardLast4: string | null;
  requiresReceipt: boolean;
  expenseId: string | null;
  ignored: boolean;
  ignoreReason: string | null;
}

/** Ce que la synchronisation écrit (le reste — rapprochement, dispense — est à nous). */
export type RevolutTransactionImport = Omit<
  RevolutTransactionProps,
  "id" | "paymentAccountId" | "expenseId" | "ignored" | "ignoreReason"
> & { raw: unknown };
