import {
  ExpenseStatusDTO,
  type AmountByKeyDTO,
  ExpenseIssueDTO,
  type DashboardDTO,
  type ExpenseDTO,
  type RevolutTransactionDTO,
} from "@repo/models";

function group(
  rows: ExpenseDTO[],
  key: (r: ExpenseDTO) => string | null,
  label: (r: ExpenseDTO) => string | null,
  none: string,
): AmountByKeyDTO[] {
  const map = new Map<string | null, AmountByKeyDTO>();
  for (const r of rows) {
    const k = key(r);
    const entry = map.get(k) ?? {
      key: k,
      label: label(r) ?? none,
      count: 0,
      amountChf: 0,
    };
    entry.count++;
    entry.amountChf += r.booking.amountChf ?? 0;
    map.set(k, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, amountChf: Math.round(e.amountChf * 100) / 100 }))
    .sort((a, b) => b.amountChf - a.amountChf);
}

/**
 * Tableau de bord d'une période : dépenses par statut et liens manquants, montants CHF par compte
 * et par type (pièces ignorées exclues), sorties Revolut sans pièce.
 */
export function buildDashboard(
  from: string,
  to: string,
  expenses: ExpenseDTO[],
  missing: RevolutTransactionDTO[],
): DashboardDTO {
  const byStatus = Object.fromEntries(
    Object.values(ExpenseStatusDTO).map((s) => [s, 0]),
  ) as Record<ExpenseStatusDTO, number>;
  for (const e of expenses) byStatus[e.status]++;
  const counted = expenses.filter((e) => e.status !== ExpenseStatusDTO.IGNORED);
  const total = counted.reduce((sum, e) => sum + (e.booking.amountChf ?? 0), 0);
  const missingChf = missing
    .filter((t) => t.currency === "CHF")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const issue = (i: ExpenseIssueDTO) =>
    expenses.filter((e) => e.issues.includes(i)).length;
  return {
    from,
    to,
    byStatus,
    issues: {
      missingReceipt: issue(ExpenseIssueDTO.MISSING_RECEIPT),
      notInBexio: issue(ExpenseIssueDTO.NOT_IN_BEXIO),
      notReconciled: issue(ExpenseIssueDTO.NOT_RECONCILED),
    },
    byAccount: group(
      counted,
      (r) => r.paymentAccountId,
      (r) => r.paymentAccountName,
      "Non classé",
    ),
    byCategory: group(
      counted,
      (r) => r.categoryId,
      (r) => r.categoryLabel,
      "Sans type",
    ),
    missingReceipts: {
      count: missing.length,
      amountChf: Math.round(missingChf * 100) / 100,
    },
    totalChf: Math.round(total * 100) / 100,
  };
}
