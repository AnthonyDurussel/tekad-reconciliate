import { last4OfMasked, requiresReceipt } from "@repo/models";

/** Transaction telle que l'API Revolut Business la rend (`GET /transactions`). */
export interface RevolutApiTransaction {
  id: string;
  type: string;
  state: string;
  created_at: string;
  completed_at?: string | null;
  reference?: string | null;
  merchant?: {
    name?: string | null;
    city?: string | null;
    category_code?: string | null;
    country?: string | null;
  } | null;
  card?: { card_number?: string | null } | null;
  legs: {
    leg_id: string;
    account_id: string;
    amount: number;
    currency: string;
    bill_amount?: number | null;
    bill_currency?: string | null;
    description?: string | null;
  }[];
}

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

/**
 * Une ligne par jambe : un virement entre deux comptes de la société a deux
 * jambes, chacune sur son compte. Le montant facturé (devise du commerçant)
 * permet de rapprocher un ticket en EUR d'un débit en CHF.
 */
export function fromRevolutApi(
  tx: RevolutApiTransaction,
): RevolutTransactionImport[] {
  return tx.legs.map((leg) => {
    const base = {
      type: tx.type,
      state: tx.state,
      amount: leg.amount,
    };
    return {
      revolutId: tx.id,
      legId: leg.leg_id,
      revolutAccountId: leg.account_id,
      type: tx.type,
      state: tx.state,
      occurredAt: new Date(tx.completed_at ?? tx.created_at),
      description: leg.description ?? tx.reference ?? null,
      merchantName: tx.merchant?.name ?? null,
      merchantCity: tx.merchant?.city ?? null,
      merchantCountry: tx.merchant?.country ?? null,
      mcc: tx.merchant?.category_code ?? null,
      amount: leg.amount,
      currency: leg.currency,
      billAmount: leg.bill_amount ?? null,
      billCurrency: leg.bill_currency ?? null,
      cardLast4: last4OfMasked(tx.card?.card_number),
      requiresReceipt: requiresReceipt(base),
      raw: tx,
    };
  });
}
