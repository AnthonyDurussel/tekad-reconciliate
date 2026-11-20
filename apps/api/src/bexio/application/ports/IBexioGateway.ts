import type { BexioAccountDTO, BexioTaxDTO } from "@repo/models";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";

/** Fichier de l'inbox bexio (non archivé). */
export interface BexioInboxFile {
  id: string;
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

/** Port vers bexio : inbox, fichiers, écritures manuelles. */
export interface IBexioGateway {
  readonly configured: boolean;
  listInboxFiles(): Promise<BexioInboxFile[]>;
  downloadFile(id: string): Promise<StoredFile>;
  /** Le plan comptable (tous les comptes, actifs ou non). */
  listAccounts(): Promise<BexioAccountDTO[]>;
  /** Les codes TVA. */
  listTaxes(): Promise<BexioTaxDTO[]>;
  /** Passe l'écriture (débit / crédit / TVA) et joint la pièce ; rend l'id de l'écriture. */
  createManualEntry(input: BexioManualEntryInput): Promise<string>;
}
