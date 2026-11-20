import type { BexioAccountDTO, BexioTaxDTO } from "@repo/models";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";

/** Fichier de l'inbox bexio (non archivé). */
export interface BexioInboxFile {
  id: string;
  /** UUID du fichier : c'est par lui qu'une dépense bexio joint ses pièces. */
  uuid: string | null;
  name: string;
  mimeType: string | null;
  createdAt: string | null;
}

export interface BexioManualEntryInput {
  date: string;
  reference: string;
  description: string;
  amountChf: number;
  debitAccountNo: string;
  creditAccountNo: string;
  taxId: number | null;
  /** Pièce jointe à la ligne d'écriture. */
  attachment: StoredFile | null;
}

/** Compte bancaire bexio (`3.0/banking/accounts`) et son compte du plan comptable. */
export interface BexioBankAccount {
  id: number;
  name: string;
  /** Id du compte du plan comptable (`2.0/accounts`). */
  accountId: number | null;
  iban: string | null;
}

/** Dépense bexio (« Ausgabe », `4.0/expenses`). */
export interface BexioExpense {
  id: string;
  documentNo: string;
  title: string | null;
  vendor: string | null;
  status: string;
  paidOn: string | null;
  gross: number;
  currency: string;
  bookingAccountId: number | null;
  bankAccountId: number | null;
  transactionId: string | null;
  attachmentIds: string[];
}

export interface BexioExpenseInput {
  paidOn: string;
  title: string;
  amountChf: number;
  bankAccountId: number;
  bookingAccountId: number;
  taxId: number | null;
  /** UUID des fichiers à joindre (la pièce). */
  attachmentIds: string[];
}

/** Port vers bexio : inbox, fichiers, plan comptable, dépenses, écritures manuelles. */
export interface IBexioGateway {
  readonly configured: boolean;
  listInboxFiles(): Promise<BexioInboxFile[]>;
  downloadFile(id: string): Promise<StoredFile>;
  /** Le plan comptable (tous les comptes, actifs ou non). */
  listAccounts(): Promise<BexioAccountDTO[]>;
  /** Les codes TVA. */
  listTaxes(): Promise<BexioTaxDTO[]>;
  /** UUID d'un fichier connu par son id. */
  fileUuid(id: string): Promise<string>;
  listBankAccounts(): Promise<BexioBankAccount[]>;
  /** Toutes les dépenses (pages de 500). */
  listExpenses(): Promise<BexioExpense[]>;
  /** Crée la dépense, pièce jointe, et la passe à `DONE` ; rend son UUID. */
  createExpense(input: BexioExpenseInput): Promise<string>;
  /** Joint des fichiers à une dépense existante (les pièces déjà jointes restent). */
  attachFilesToExpense(expenseId: string, fileUuids: string[]): Promise<void>;
  /** Passe l'écriture (débit / crédit / TVA) et joint la pièce ; rend l'id de l'écriture. */
  createManualEntry(input: BexioManualEntryInput): Promise<string>;
}
