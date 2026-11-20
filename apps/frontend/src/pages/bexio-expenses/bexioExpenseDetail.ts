import {
  ReconciliationModeDTO,
  type BexioExpenseDetailDTO,
  type BexioExpenseDTO,
} from "@repo/models";

/** Comment afficher un fichier : image, sinon dans un cadre (PDF, inconnu). */
export type PreviewKind = "image" | "frame";

export function previewKind(mimeType: string | null | undefined): PreviewKind {
  return mimeType?.toLowerCase().startsWith("image/") ? "image" : "frame";
}

/** Un fichier à prévisualiser : joint dans bexio, ou celui de la pièce liée. */
export interface PreviewFile {
  key: string;
  url: string;
  /** `null` : nom inconnu (« Fichier n » à l'affichage). */
  name: string | null;
  kind: PreviewKind;
}

/**
 * Les fichiers de la dépense : ses fichiers joints dans bexio ; à défaut, le
 * fichier de la pièce liée ; sinon rien.
 */
export function previewFiles(
  detail: Pick<BexioExpenseDetailDTO, "id" | "attachments" | "expenseId">,
  urls: {
    attachment: (id: string, uuid: string) => string;
    expense: (expenseId: string) => string;
  },
  linked?: { fileName: string | null; mimeType: string | null } | null,
): PreviewFile[] {
  if (detail.attachments.length > 0) {
    return detail.attachments.map((a) => ({
      key: a.uuid,
      url: urls.attachment(detail.id, a.uuid),
      name: a.name,
      kind: previewKind(a.mimeType),
    }));
  }
  if (detail.expenseId) {
    return [
      {
        key: `expense:${detail.expenseId}`,
        url: urls.expense(detail.expenseId),
        name: linked?.fileName ?? null,
        kind: previewKind(linked?.mimeType),
      },
    ];
  }
  return [];
}

/** D'où vient le compte payeur, `UNKNOWN` : aucun compte retrouvé. */
export type PaymentSourceKey =
  NonNullable<BexioExpenseDTO["paymentAccountSource"]> | "UNKNOWN";

export function paymentSourceKey(
  expense: Pick<BexioExpenseDTO, "paymentAccountId" | "paymentAccountSource">,
): PaymentSourceKey {
  if (!expense.paymentAccountId) return "UNKNOWN";
  return expense.paymentAccountSource ?? "ACCOUNT_NO";
}

/** État du rapprochement d'une dépense, pour le libellé et la marche à suivre. */
export type ReconciliationState =
  | "inBexio"
  | "byStatement"
  | "toReconcileInBexio"
  | "toReconcileByStatement"
  | "linkReceiptFirst"
  | "unknownAccount"
  | "notRequired";

export function reconciliationState(
  expense: Pick<
    BexioExpenseDTO,
    "reconciled" | "bexioReconciled" | "reconciliation" | "expenseId"
  > & { paymentAccountId?: string | null },
): ReconciliationState {
  // Compte payeur inconnu : on ne sait pas encore s'il faut rapprocher.
  if (expense.reconciled === null && expense.paymentAccountId === null)
    return "unknownAccount";
  if (expense.reconciled === null) return "notRequired";
  if (expense.reconciled)
    return expense.bexioReconciled ? "inBexio" : "byStatement";
  if (expense.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT)
    return expense.expenseId ? "toReconcileByStatement" : "linkReceiptFirst";
  return "toReconcileInBexio";
}
