import { ReconciliationModeDTO, type BexioExpenseDTO } from "@repo/models";

/** Le rapprochement d'une dépense bexio, pour son libellé et sa marche à suivre. */
export type ReconciliationState =
  | "inBexio"
  | "toReconcileInBexio"
  | "byStatement"
  | "notRequired"
  | "unknownAccount";

/**
 * Rapprochée dans bexio (`transaction_id`) ; sinon ce qu'exige le compte
 * payeur : rapprochement dans bexio, par le relevé importé (sur la dépense
 * de l'application), rien — ou compte payeur inconnu.
 */
export function reconciliationState(
  expense: Pick<BexioExpenseDTO, "bexioReconciled" | "reconciliation">,
): ReconciliationState {
  if (expense.bexioReconciled) return "inBexio";
  switch (expense.reconciliation) {
    case ReconciliationModeDTO.BEXIO:
      return "toReconcileInBexio";
    case ReconciliationModeDTO.STATEMENT_IMPORT:
      return "byStatement";
    case ReconciliationModeDTO.NONE:
      return "notRequired";
    default:
      return "unknownAccount";
  }
}

export const STATE_COLOR: Record<ReconciliationState, string> = {
  inBexio: "teal",
  toReconcileInBexio: "orange",
  byStatement: "grape",
  notRequired: "gray",
  unknownAccount: "gray",
};
