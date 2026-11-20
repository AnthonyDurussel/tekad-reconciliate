import dayjs from "dayjs";
import {
  BexioExpenseIssueDTO,
  ExpenseStatusDTO,
  type BexioExpenseDTO,
  type ExpenseDTO,
} from "@repo/models";

/**
 * Filtre de la liste : toutes, à traiter (au moins un problème), sans pièce,
 * à rapprocher, sans problème.
 */
export type IssueFilter =
  | "all"
  | "todo"
  | BexioExpenseIssueDTO.MISSING_RECEIPT
  | BexioExpenseIssueDTO.NOT_RECONCILED
  | "ok";

export const ISSUE_FILTERS: IssueFilter[] = [
  "all",
  "todo",
  BexioExpenseIssueDTO.MISSING_RECEIPT,
  BexioExpenseIssueDTO.NOT_RECONCILED,
  "ok",
];

/** La valeur de l'URL (`?issue=`), « all » si absente ou inconnue. */
export function parseIssueFilter(value: string | null): IssueFilter {
  return ISSUE_FILTERS.includes(value as IssueFilter)
    ? (value as IssueFilter)
    : "all";
}

export function matchesIssue(
  expense: BexioExpenseDTO,
  filter: IssueFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "todo":
      return expense.issues.length > 0;
    case "ok":
      return expense.issues.length === 0;
    default:
      return expense.issues.includes(filter);
  }
}

export function filterByIssue(
  expenses: BexioExpenseDTO[],
  filter: IssueFilter,
): BexioExpenseDTO[] {
  return expenses.filter((e) => matchesIssue(e, filter));
}

export interface SummaryLine {
  count: number;
  /** Total des montants en CHF (les autres devises à part). */
  amountChf: number;
}

export interface BexioExpenseSummary {
  all: SummaryLine;
  missingReceipt: SummaryLine;
  notReconciled: SummaryLine;
  ok: SummaryLine;
}

/** Les tuiles du haut de page : nombre et montant CHF par catégorie. */
export function summarize(expenses: BexioExpenseDTO[]): BexioExpenseSummary {
  const line = (filter: IssueFilter): SummaryLine => {
    const rows = filterByIssue(expenses, filter);
    return {
      count: rows.length,
      amountChf: rows
        .filter((e) => e.currency === "CHF")
        .reduce((sum, e) => sum + e.gross, 0),
    };
  };
  return {
    all: line("all"),
    missingReceipt: line(BexioExpenseIssueDTO.MISSING_RECEIPT),
    notReconciled: line(BexioExpenseIssueDTO.NOT_RECONCILED),
    ok: line("ok"),
  };
}

/** Écart de dates accepté autour de la date de paiement pour proposer une pièce. */
export const CANDIDATE_DAYS = 10;

/** La fenêtre de recherche des pièces candidates (`GET expenses?from&to`). */
export function candidateWindow(
  paidOn: string | null,
  fallback: { from: string; to: string },
): { from: string; to: string } {
  if (!paidOn) return fallback;
  const day = dayjs(paidOn);
  return {
    from: day.subtract(CANDIDATE_DAYS, "day").format("YYYY-MM-DD"),
    to: day.add(CANDIDATE_DAYS, "day").format("YYYY-MM-DD"),
  };
}

/** Montant d'une pièce comparable au brut bexio : CHF comptabilisé, sinon lu. */
export function receiptAmount(expense: ExpenseDTO): number | null {
  return expense.booking.amountChf ?? expense.totalAmount;
}

export interface RankedCandidate {
  expense: ExpenseDTO;
  /** Écart de montant (absolu), `null` : pièce sans montant. */
  amountGap: number | null;
  /** Écart en jours avec la date de paiement, `null` : date inconnue. */
  dayGap: number | null;
}

/**
 * Les pièces qu'on peut lier à une dépense bexio : ni ignorées ni déjà liées
 * à une dépense bexio, triées par écart de montant (au centime près), puis
 * par écart de date ; les pièces sans montant ou sans date en dernier.
 */
export function rankCandidates(
  bexioExpense: Pick<BexioExpenseDTO, "gross" | "paidOn">,
  expenses: ExpenseDTO[],
): RankedCandidate[] {
  const paid = bexioExpense.paidOn ? dayjs(bexioExpense.paidOn) : null;
  const gross = Math.abs(bexioExpense.gross);
  return expenses
    .filter(
      (e) => e.status !== ExpenseStatusDTO.IGNORED && e.bexioExpenseId === null,
    )
    .map((expense) => {
      const amount = receiptAmount(expense);
      return {
        expense,
        amountGap:
          amount === null
            ? null
            : Math.round(Math.abs(Math.abs(amount) - gross) * 100) / 100,
        dayGap:
          paid && expense.date
            ? Math.abs(dayjs(expense.date).diff(paid, "day"))
            : null,
      };
    })
    .sort(
      (a, b) =>
        (a.amountGap ?? Infinity) - (b.amountGap ?? Infinity) ||
        (a.dayGap ?? Infinity) - (b.dayGap ?? Infinity),
    );
}

/** Recherche libre sur le fichier, le commerçant et la description. */
export function matchesCandidateSearch(
  expense: ExpenseDTO,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    expense.fileName,
    expense.merchant,
    expense.description,
    expense.paymentAccountName,
    expense.totalAmount?.toFixed(2),
  ].some((value) => value?.toLowerCase().includes(needle));
}
