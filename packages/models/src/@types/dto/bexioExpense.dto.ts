import type { ReconciliationModeDTO } from "./settings.dto.js";

/**
 * Une dépense de bexio (« Ausgaben », `GET 4.0/expenses`), synchronisée :
 * chaque dépense doit avoir sa pièce (fichier joint) et, si son compte
 * payeur l'exige, être rapprochée — dans bexio (`transaction_id`) ou ici, par
 * la transaction du relevé importé rapprochée de sa pièce.
 */
export enum BexioExpenseIssueDTO {
  /** Aucune pièce jointe dans bexio ni pièce liée ici. */
  MISSING_RECEIPT = "MISSING_RECEIPT",
  /** Compte rapproché (bexio ou import) mais dépense pas encore rapprochée. */
  NOT_RECONCILED = "NOT_RECONCILED",
  /** Le compte bancaire bexio ne correspond à aucun compte de paiement. */
  UNKNOWN_ACCOUNT = "UNKNOWN_ACCOUNT",
  /** Encore en brouillon dans bexio. */
  DRAFT = "DRAFT",
}

export interface BexioExpenseDTO {
  /** UUID bexio. */
  id: string;
  documentNo: string;
  title: string | null;
  vendor: string | null;
  /** `DRAFT` | `DONE` (bexio). */
  status: string;
  paidOn: string | null;
  gross: number;
  currency: string;
  bookingAccountNo: string | null;
  bookingAccountName: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  /** Rapprochement exigé par le compte payeur (`null` : compte inconnu). */
  reconciliation: ReconciliationModeDTO | null;
  /** Fichiers joints dans bexio. */
  attachmentCount: number;
  /** La pièce de l'application liée (fichier joint, ou dépense créée par l'application). */
  expenseId: string | null;
  expenseFileName: string | null;
  /** Rapprochée dans bexio (`transaction_id`). */
  bexioReconciled: boolean;
  /** Transaction du relevé importé rapprochée de sa pièce. */
  statementTransactionId: string | null;
  /** `null` : pas de rapprochement exigé (compte sans relevé). */
  reconciled: boolean | null;
  issues: BexioExpenseIssueDTO[];
  syncedAt: string;
}

export interface BexioExpenseQueryDTO {
  from?: string;
  to?: string;
  paymentAccountId?: string | "none";
  /** `ok` : sans problème ; sinon un `BexioExpenseIssueDTO`. */
  issue?: BexioExpenseIssueDTO | "ok";
  search?: string;
}

/** `POST bexio-expenses/{id}/link` : la pièce à joindre à la dépense bexio. */
export interface LinkBexioExpenseDTO {
  expenseId: string;
}
