import type { RevolutTransactionDTO } from "@repo/models";
import { formatAmount, formatCard, formatDate } from "@/utils/format";

/** Le nom affiché d'une transaction : commerçant, à défaut libellé ou type. */
export const merchantOf = (tx: RevolutTransactionDTO) =>
  tx.merchantName ?? tx.description ?? tx.type;

/** Totaux par devise du compte (les sorties, en valeur absolue). */
export function totalsByCurrency(transactions: RevolutTransactionDTO[]) {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    totals.set(
      tx.currency,
      (totals.get(tx.currency) ?? 0) + Math.abs(tx.amount),
    );
  }
  return [...totals.entries()].map(([currency, amount]) =>
    formatAmount(amount, currency),
  );
}

/** La liste des pièces à demander, en texte brut (e-mail, message). */
export function missingReceiptsText(
  transactions: RevolutTransactionDTO[],
  heading: string,
): string {
  const lines = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((tx) => {
      const foreign =
        tx.billAmount != null &&
        tx.billCurrency &&
        tx.billCurrency !== tx.currency
          ? ` (${formatAmount(Math.abs(tx.billAmount), tx.billCurrency)})`
          : "";
      const card = tx.cardLast4 ? ` — ${formatCard(tx.cardLast4)}` : "";
      return `${formatDate(tx.date)} — ${merchantOf(tx)} — ${formatAmount(Math.abs(tx.amount), tx.currency)}${foreign}${card}`;
    });
  return [heading, "", ...lines].join("\n");
}
