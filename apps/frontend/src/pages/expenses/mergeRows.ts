import {
  ReconciliationModeDTO,
  type BexioExpenseDTO,
  type ExpenseCategoryDTO,
  type ExpenseDTO,
} from "@repo/models";
import {
  ISSUE_FILTERS,
  type ExpenseLinkStates,
  type IssueFilter,
} from "./expenseLinks";

/** Valeur des filtres « compte » et « type » pour « non renseigné ». */
export const NONE = "none";

/** « À faire » : pas dans l'application — une dépense bexio sans dépense ici. */
export const NOT_IN_APP = "not_in_app";

/**
 * Filtre « À faire » de la liste fusionnée : ceux de l'API, plus
 * `not_in_app` (frontend seulement, jamais envoyé à l'API).
 */
export type ListIssueFilter = IssueFilter | typeof NOT_IN_APP;

export const LIST_ISSUE_FILTERS: ListIssueFilter[] = [
  ...ISSUE_FILTERS,
  NOT_IN_APP,
];

/** La valeur de l'URL, `null` si absente ou inconnue. */
export function parseListIssueFilter(
  value: string | null,
): ListIssueFilter | null {
  return LIST_ISSUE_FILTERS.includes(value as ListIssueFilter)
    ? (value as ListIssueFilter)
    : null;
}

/** Le filtre « À faire » à envoyer à `GET expenses` (jamais `not_in_app`). */
export function apiIssueFilter(
  issue: ListIssueFilter | null,
): IssueFilter | undefined {
  return issue && issue !== NOT_IN_APP ? issue : undefined;
}

/** Une ligne de la liste : une dépense de l'application, ou une dépense bexio sans elle. */
export type ExpenseListRow =
  | {
      kind: "expense";
      key: string;
      date: string | null;
      expense: ExpenseDTO;
      /** Le n° de la dépense bexio rattachée, quand la liste bexio le donne. */
      bexioDocumentNo: string | null;
    }
  | {
      kind: "bexio";
      key: string;
      date: string | null;
      bexio: BexioExpenseDTO;
    };

export interface ListFilters {
  /** Compte de paiement : un id, `none` (non renseigné) ou `null` (tous). */
  paymentAccountId: string | null;
  /** Type de dépense : un id, `none` (sans type) ou `null` (tous). */
  categoryId: string | null;
  /** Un statut de dépense : les dépenses bexio n'en ont pas. */
  status: string | null;
  issue: ListIssueFilter | null;
}

/**
 * Les dépenses bexio à montrer en lignes propres : celles sans dépense dans
 * l'application, filtrées comme la liste — compte payeur (`none` : compte
 * inconnu), type par son compte de charge (`none` : aucun type pour ce
 * compte) ; masquées dès qu'un statut ou un « À faire » autre que
 * « Pas dans l'application » est choisi.
 */
export function bexioOnlyRows(
  bexio: BexioExpenseDTO[],
  filters: ListFilters,
  categories: Pick<ExpenseCategoryDTO, "id" | "bexioAccountNo">[],
): BexioExpenseDTO[] {
  if (filters.status) return [];
  if (filters.issue && filters.issue !== NOT_IN_APP) return [];
  const accountsWithType = new Set(categories.map((c) => c.bexioAccountNo));
  const category =
    filters.categoryId && filters.categoryId !== NONE
      ? categories.find((c) => c.id === filters.categoryId)
      : undefined;
  return bexio.filter((b) => {
    if (b.expenseId !== null) return false;
    if (filters.paymentAccountId === NONE) {
      if (b.paymentAccountId !== null) return false;
    } else if (
      filters.paymentAccountId &&
      b.paymentAccountId !== filters.paymentAccountId
    ) {
      return false;
    }
    if (filters.categoryId === NONE) {
      if (b.bookingAccountNo && accountsWithType.has(b.bookingAccountNo))
        return false;
    } else if (filters.categoryId) {
      if (!category || b.bookingAccountNo !== category.bexioAccountNo)
        return false;
    }
    return true;
  });
}

/**
 * La liste fusionnée : les dépenses de l'application (déjà filtrées par
 * l'API ; aucune avec `not_in_app`) et les dépenses bexio qui n'y sont pas,
 * par date décroissante (sans date en dernier, ordre de l'API gardé à date
 * égale).
 */
export function mergeRows(
  expenses: ExpenseDTO[],
  bexio: BexioExpenseDTO[],
  filters: ListFilters,
  categories: Pick<ExpenseCategoryDTO, "id" | "bexioAccountNo">[],
): ExpenseListRow[] {
  const documentNo = new Map(bexio.map((b) => [b.id, b.documentNo]));
  const appRows: ExpenseListRow[] =
    filters.issue === NOT_IN_APP
      ? []
      : expenses.map((expense) => ({
          kind: "expense",
          key: `e:${expense.id}`,
          date: expense.date,
          expense,
          bexioDocumentNo: expense.bexioExpenseId
            ? (documentNo.get(expense.bexioExpenseId) ?? null)
            : null,
        }));
  const bexioRows: ExpenseListRow[] = bexioOnlyRows(
    bexio,
    filters,
    categories,
  ).map((b) => ({ kind: "bexio", key: `b:${b.id}`, date: b.paidOn, bexio: b }));
  if (bexioRows.length === 0) return appRows;
  return [...appRows, ...bexioRows].sort(byDateDesc);
}

function byDateDesc(a: ExpenseListRow, b: ExpenseListRow): number {
  if (a.date === b.date) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date < b.date ? 1 : -1;
}

export interface ListTotals {
  app: { count: number; chf: number; unpriced: number };
  /** Les dépenses bexio hors application ; montants en CHF seulement. */
  bexio: { count: number; chf: number; otherCurrency: number };
}

/** Le pied de tableau : l'application et bexio seulement, séparément. */
export function listTotals(rows: ExpenseListRow[]): ListTotals {
  const totals: ListTotals = {
    app: { count: 0, chf: 0, unpriced: 0 },
    bexio: { count: 0, chf: 0, otherCurrency: 0 },
  };
  for (const row of rows) {
    if (row.kind === "expense") {
      totals.app.count += 1;
      const chf = row.expense.booking.amountChf;
      if (chf === null) totals.app.unpriced += 1;
      else totals.app.chf += chf;
    } else {
      totals.bexio.count += 1;
      if (row.bexio.currency === "CHF") totals.bexio.chf += row.bexio.gross;
      else totals.bexio.otherCurrency += 1;
    }
  }
  return totals;
}

/**
 * Les liens d'une dépense bexio absente de l'application : pièce = un
 * fichier joint dans bexio ; bexio = fait ; relevé = rapprochée dans bexio,
 * à faire pour un compte rapproché par relevé (par la dépense à créer ici),
 * sinon rien à faire.
 */
export function bexioLinkStates(
  bexio: Pick<
    BexioExpenseDTO,
    "attachmentIds" | "bexioReconciled" | "reconciliation"
  >,
): ExpenseLinkStates {
  return {
    receipt: bexio.attachmentIds.length > 0 ? "ok" : "missing",
    bexio: "ok",
    reconciliation: bexio.bexioReconciled
      ? "ok"
      : bexio.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT
        ? "missing"
        : "na",
  };
}
