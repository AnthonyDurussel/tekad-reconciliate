import type { RevolutTransactionDTO } from "@repo/models";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";

export const RevolutMapper = {
  toDTO(t: RevolutTransactionProps): RevolutTransactionDTO {
    return {
      id: t.id,
      revolutId: t.revolutId,
      revolutAccountId: t.revolutAccountId,
      paymentAccountId: t.paymentAccountId,
      type: t.type,
      state: t.state,
      date: t.occurredAt.toISOString(),
      description: t.description,
      merchantName: t.merchantName,
      merchantCity: t.merchantCity,
      merchantCountry: t.merchantCountry,
      mcc: t.mcc,
      amount: t.amount,
      currency: t.currency,
      billAmount: t.billAmount,
      billCurrency: t.billCurrency,
      cardLast4: t.cardLast4,
      expenseId: t.expenseId,
      ignored: t.ignored,
      ignoreReason: t.ignoreReason,
      requiresReceipt: t.requiresReceipt,
    };
  },
};
