import { BexioExpenseIssueDTO, ReconciliationModeDTO } from "@repo/models";

export interface BexioExpenseCheckInput {
  status: string;
  attachmentCount: number;
  /** Une pièce de l'application est liée. */
  hasLinkedReceipt: boolean;
  /** Un compte bancaire est indiqué sur la dépense bexio. */
  hasBankAccount: boolean;
  /** Le rapprochement du compte de paiement retrouvé (`null` : aucun compte). */
  reconciliation: ReconciliationModeDTO | null;
  /** Rapprochée dans bexio (`transaction_id`). */
  bexioReconciled: boolean;
  /** La pièce liée a sa transaction de relevé importé. */
  statementMatched: boolean;
}

export interface BexioExpenseCheck {
  /** `null` : aucun rapprochement exigé. */
  reconciled: boolean | null;
  issues: BexioExpenseIssueDTO[];
}

/**
 * Ce qui manque à une dépense bexio :
 * - une pièce (fichier joint dans bexio, ou pièce liée ici) ;
 * - le rapprochement exigé par son compte : dans bexio (`transaction_id`)
 *   pour un compte rapproché dans bexio ; pour un compte importé, la
 *   transaction du relevé rapprochée de sa pièce (ou un rapprochement bexio) ;
 *   rien pour un compte sans relevé.
 */
export function checkBexioExpense(
  input: BexioExpenseCheckInput,
): BexioExpenseCheck {
  const issues: BexioExpenseIssueDTO[] = [];
  if (input.status === "DRAFT") issues.push(BexioExpenseIssueDTO.DRAFT);
  if (input.attachmentCount === 0 && !input.hasLinkedReceipt) {
    issues.push(BexioExpenseIssueDTO.MISSING_RECEIPT);
  }
  if (!input.reconciliation) {
    if (input.hasBankAccount) issues.push(BexioExpenseIssueDTO.UNKNOWN_ACCOUNT);
    return { reconciled: null, issues };
  }
  let reconciled: boolean | null = null;
  if (input.reconciliation === ReconciliationModeDTO.BEXIO) {
    reconciled = input.bexioReconciled;
  } else if (input.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT) {
    reconciled = input.statementMatched || input.bexioReconciled;
  }
  if (reconciled === false) issues.push(BexioExpenseIssueDTO.NOT_RECONCILED);
  return { reconciled, issues };
}
