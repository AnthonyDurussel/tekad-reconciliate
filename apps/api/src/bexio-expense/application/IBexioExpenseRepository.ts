import type { BexioExpense } from "@/bexio/application/ports/IBexioGateway.js";

/** Une dépense bexio gardée, avec ce que la synchronisation a résolu. */
export interface StoredBexioExpense extends BexioExpense {
  bookingAccountNo: string | null;
  bookingAccountName: string | null;
  /** N° du plan comptable du compte bancaire payeur. */
  bankAccountNo: string | null;
  /** Compte de paiement choisi sur la dépense (gardé à la synchronisation). */
  paymentAccountId: string | null;
  syncedAt: Date;
}

export interface BexioExpenseFilter {
  from?: Date;
  /** Exclu. */
  to?: Date;
  search?: string;
}

export interface IBexioExpenseRepository {
  /** Remplace le contenu par la liste lue dans bexio (les absentes disparaissent). */
  replaceAll(
    rows: Omit<StoredBexioExpense, "syncedAt" | "paymentAccountId">[],
  ): Promise<void>;
  setPaymentAccount(id: string, paymentAccountId: string | null): Promise<void>;
  list(filter: BexioExpenseFilter): Promise<StoredBexioExpense[]>;
  find(id: string): Promise<StoredBexioExpense | null>;
  setAttachments(id: string, attachmentIds: string[]): Promise<void>;
}
