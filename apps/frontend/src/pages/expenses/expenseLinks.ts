import dayjs from "dayjs";
import {
  ExpenseIssueDTO,
  ExpenseStatusDTO,
  ReconciliationModeDTO,
  type ExpenseDTO,
  type ReceiptDTO,
} from "@repo/models";

/** Filtre « À faire » de la liste (`?issue=`) : un problème, ou `ok`. */
export type IssueFilter = ExpenseIssueDTO | "ok";

export const ISSUE_FILTERS: IssueFilter[] = [
  ExpenseIssueDTO.MISSING_RECEIPT,
  ExpenseIssueDTO.NOT_IN_BEXIO,
  ExpenseIssueDTO.NOT_RECONCILED,
  "ok",
];

/** La valeur de l'URL, `null` si absente ou inconnue. */
export function parseIssueFilter(value: string | null): IssueFilter | null {
  return ISSUE_FILTERS.includes(value as IssueFilter)
    ? (value as IssueFilter)
    : null;
}

/** Le nom affiché d'une dépense : commerçant, fichier, libellé du relevé. */
export function expenseLabel(
  expense: Pick<ExpenseDTO, "merchant" | "fileName" | "description"> & {
    transaction?: ExpenseDTO["transaction"];
  },
): string | null {
  return (
    expense.merchant ??
    expense.fileName ??
    expense.transaction?.merchantName ??
    expense.transaction?.description ??
    expense.description ??
    null
  );
}

/** `ok` : fait ; `missing` : à faire ; `na` : rien à faire. */
export type LinkState = "ok" | "missing" | "na";

export interface ExpenseLinkStates {
  receipt: LinkState;
  bexio: LinkState;
  reconciliation: LinkState;
}

/**
 * Où en sont les trois liens d'une dépense : sa pièce, bexio (dépense bexio,
 * écriture manuelle, ou comptabilisée par le rapprochement bancaire de
 * bexio) et — pour un compte rapproché par import de relevé — sa transaction.
 */
export function linkStates(
  expense: Pick<
    ExpenseDTO,
    | "issues"
    | "receiptId"
    | "bexioExpenseId"
    | "bexioEntryId"
    | "transactionId"
    | "reconciliation"
    | "status"
  >,
): ExpenseLinkStates {
  const has = (issue: ExpenseIssueDTO) => expense.issues.includes(issue);
  const ignored = expense.status === ExpenseStatusDTO.IGNORED;
  return {
    receipt: expense.receiptId
      ? "ok"
      : has(ExpenseIssueDTO.MISSING_RECEIPT) || !ignored
        ? "missing"
        : "na",
    bexio: has(ExpenseIssueDTO.NOT_IN_BEXIO)
      ? "missing"
      : expense.bexioExpenseId ||
          expense.bexioEntryId ||
          expense.status === ExpenseStatusDTO.BOOKED
        ? "ok"
        : "na",
    reconciliation: expense.transactionId
      ? "ok"
      : has(ExpenseIssueDTO.NOT_RECONCILED) ||
          (expense.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT &&
            !ignored)
        ? "missing"
        : "na",
  };
}

/** Montant d'une dépense comparable à celui d'une pièce. */
function expenseAmount(expense: ExpenseDTO): number | null {
  return expense.totalAmount ?? expense.booking.amountChf;
}

export interface RankedReceipt {
  receipt: ReceiptDTO;
  /** Écart de montant (absolu, au centime), `null` : montant inconnu. */
  amountGap: number | null;
  /** Écart en jours, `null` : date inconnue. */
  dayGap: number | null;
}

/**
 * Les pièces candidates, les plus proches du montant de la dépense en tête,
 * puis de sa date ; celles sans montant ou sans date en dernier.
 */
export function rankReceipts(
  expense: ExpenseDTO,
  receipts: ReceiptDTO[],
): RankedReceipt[] {
  const amount = expenseAmount(expense);
  const date = expense.date ? dayjs(expense.date) : null;
  return receipts
    .map((receipt) => {
      const total = receipt.extraction?.totalAmount ?? null;
      const day = receipt.extraction?.date ?? null;
      return {
        receipt,
        amountGap:
          amount === null || total === null
            ? null
            : Math.round(Math.abs(Math.abs(total) - Math.abs(amount)) * 100) /
              100,
        dayGap: date && day ? Math.abs(dayjs(day).diff(date, "day")) : null,
      };
    })
    .sort(
      (a, b) =>
        (a.amountGap ?? Infinity) - (b.amountGap ?? Infinity) ||
        (a.dayGap ?? Infinity) - (b.dayGap ?? Infinity),
    );
}

/** Recherche libre sur le fichier, le commerçant, la description, le montant. */
export function matchesReceiptSearch(
  receipt: ReceiptDTO,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    receipt.fileName,
    receipt.extraction?.merchant,
    receipt.extraction?.description,
    receipt.extraction?.totalAmount?.toFixed(2),
  ].some((value) => value?.toLowerCase().includes(needle));
}
