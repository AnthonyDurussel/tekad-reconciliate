import type { BexioExpenseDetailDTO, ExpenseDTO } from "@repo/models";

/** Comment afficher un fichier : image, sinon dans un cadre (PDF, inconnu). */
export type PreviewKind = "image" | "frame";

export function previewKind(mimeType: string | null | undefined): PreviewKind {
  return mimeType?.toLowerCase().startsWith("image/") ? "image" : "frame";
}

/** Un fichier à prévisualiser : joint dans bexio, ou la pièce de la dépense. */
export interface PreviewFile {
  key: string;
  url: string;
  /** `null` : nom inconnu (« Fichier n » à l'affichage). */
  name: string | null;
  kind: PreviewKind;
}

/**
 * Les fichiers de la dépense bexio : ses fichiers joints dans bexio ; à
 * défaut, la pièce de la dépense rattachée (si elle en a une) ; sinon rien.
 */
export function previewFiles(
  detail: Pick<BexioExpenseDetailDTO, "id" | "attachments" | "expenseId">,
  urls: {
    attachment: (id: string, uuid: string) => string;
    expense: (expenseId: string) => string;
  },
  linked?: Pick<ExpenseDTO, "receiptId" | "fileName" | "mimeType"> | null,
): PreviewFile[] {
  if (detail.attachments.length > 0) {
    return detail.attachments.map((a) => ({
      key: a.uuid,
      url: urls.attachment(detail.id, a.uuid),
      name: a.name,
      kind: previewKind(a.mimeType),
    }));
  }
  if (detail.expenseId && linked?.receiptId) {
    return [
      {
        key: `expense:${detail.expenseId}`,
        url: urls.expense(detail.expenseId),
        name: linked.fileName,
        kind: previewKind(linked.mimeType),
      },
    ];
  }
  return [];
}
