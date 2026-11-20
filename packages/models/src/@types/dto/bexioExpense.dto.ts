import type { ReconciliationModeDTO } from "./settings.dto.js";

/**
 * Une dépense de bexio (« Ausgabe », `GET 4.0/expenses`), lue en direct par
 * l'API — jamais copiée. `expenseId` : la dépense de l'application qui lui
 * est rattachée.
 */
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
  /** Compte du plan comptable du compte bancaire payeur. */
  bankAccountNo: string | null;
  bankAccountName: string | null;
  /** Le compte de paiement associé à ce compte du plan comptable. */
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  reconciliation: ReconciliationModeDTO | null;
  /** Rapprochée dans bexio (`transaction_id`). */
  bexioReconciled: boolean;
  attachmentIds: string[];
  /** La dépense de l'application rattachée. */
  expenseId: string | null;
}

export interface BexioExpenseQueryDTO {
  from?: string;
  to?: string;
  /** Fournisseur (bexio : `vendor`). */
  search?: string;
  /** `true` : seulement celles sans dépense de l'application. */
  unlinked?: boolean;
}

/** Un fichier joint à la dépense dans bexio. */
export interface BexioAttachmentDTO {
  uuid: string;
  /** `null` : nom non lu. */
  name: string | null;
  mimeType: string | null;
}

/** `GET bexio/expenses/{id}` : la dépense et ses fichiers joints. */
export interface BexioExpenseDetailDTO extends BexioExpenseDTO {
  attachments: BexioAttachmentDTO[];
}
