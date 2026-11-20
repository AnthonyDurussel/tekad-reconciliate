import type { BookingModeDTO, ReconciliationModeDTO } from "./settings.dto.js";
import type { RevolutTransactionDTO } from "./revolut.dto.js";

/**
 * Pièce comptable importée de l'inbox bexio.
 *
 * NEW → (lecture) → TO_REVIEW ↔ READY → BOOKED ; IGNORED à part.
 * Le statut TO_REVIEW / READY se calcule (`expenseStatus()`) : une pièce est
 * prête quand elle a un compte de paiement, un type, un montant, une date et
 * — pour Revolut — sa transaction rapprochée.
 */
export enum ExpenseStatusDTO {
  /** Importée, pas encore lue. */
  NEW = "NEW",
  TO_REVIEW = "TO_REVIEW",
  READY = "READY",
  BOOKED = "BOOKED",
  IGNORED = "IGNORED",
}

/** Ce qui manque à une dépense. */
export enum ExpenseIssueDTO {
  /** Aucune pièce rattachée. */
  MISSING_RECEIPT = "MISSING_RECEIPT",
  /** Pas encore de dépense (ni d'écriture) dans bexio. */
  NOT_IN_BEXIO = "NOT_IN_BEXIO",
  /** Compte rapproché par import de relevé, sans transaction rattachée. */
  NOT_RECONCILED = "NOT_RECONCILED",
}

/** D'où vient une dépense. */
export enum ExpenseSourceDTO {
  /** Une pièce de l'inbox bexio. */
  RECEIPT = "RECEIPT",
  /** Une transaction de relevé importé sans pièce. */
  TRANSACTION = "TRANSACTION",
  /** Une dépense saisie dans bexio. */
  BEXIO = "BEXIO",
}

/** Une pièce : un fichier de l'inbox bexio et ce que sa lecture a donné. */
export interface ReceiptDTO {
  id: string;
  bexioFileId: string;
  bexioFileUuid: string | null;
  fileName: string;
  mimeType: string | null;
  importedAt: string;
  extractedAt: string | null;
  extraction: ExtractionDTO | null;
  /** La dépense qui la porte (`null` : pièce sans dépense). */
  expenseId: string | null;
}

/** D'où vient une valeur proposée : règle, lecture IA ou saisie. */
export enum SuggestionSourceDTO {
  CARD = "CARD",
  TRANSACTION = "TRANSACTION",
  RULE = "RULE",
  AI = "AI",
  MANUAL = "MANUAL",
}

/** Ce que la lecture du ticket a trouvé. */
export interface ExtractionDTO {
  merchant: string | null;
  date: string | null;
  totalAmount: number | null;
  currency: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  /** 4 derniers chiffres de la carte imprimés sur le ticket. */
  cardLast4: string | null;
  /** Mode de paiement lu : carte, espèces, virement, facture… */
  paymentMethod: string | null;
  /** Code du type de dépense proposé par l'IA. */
  categoryCode: string | null;
  description: string | null;
  confidence: number | null;
  error?: string | null;
}

/** L'écriture proposée (ou passée) dans bexio. */
export interface BookingProposalDTO {
  mode: BookingModeDTO | null;
  date: string | null;
  description: string;
  /** Montant en CHF (Revolut : le montant débité du compte). */
  amountChf: number | null;
  debitAccountNo: string | null;
  creditAccountNo: string | null;
  bexioTaxId: number | null;
  vatRate: number | null;
  /** Ce qui manque pour comptabiliser. */
  missing: string[];
}

/**
 * La dépense : l'élément central de l'application. Elle est rattachée à une
 * pièce (`receiptId`), à une dépense bexio (`bexioExpenseId`) et, si son
 * compte se rapproche par import de relevé, à une transaction
 * (`transactionId`) ; `issues` dit ce qui manque.
 */
export interface ExpenseDTO {
  id: string;
  status: ExpenseStatusDTO;
  source: ExpenseSourceDTO;
  createdAt: string;
  issues: ExpenseIssueDTO[];
  /** Rapprochement exigé par le compte de paiement. */
  reconciliation: ReconciliationModeDTO | null;
  receiptId: string | null;
  /** La pièce rattachée (champs à plat, `null` sans pièce). */
  bexioFileId: string | null;
  fileName: string | null;
  mimeType: string | null;
  importedAt: string | null;

  date: string | null;
  merchant: string | null;
  description: string | null;
  totalAmount: number | null;
  currency: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  cardLast4: string | null;
  paymentMethod: string | null;
  extraction: ExtractionDTO | null;
  extractedAt: string | null;

  paymentAccountId: string | null;
  paymentAccountName: string | null;
  paymentAccountSource: SuggestionSourceDTO | null;
  categoryId: string | null;
  categoryLabel: string | null;
  categorySource: SuggestionSourceDTO | null;

  /** Surcharges de l'imputation proposée. */
  debitAccountNo: string | null;
  creditAccountNo: string | null;
  bexioTaxId: number | null;

  transactionId: string | null;
  transaction?: RevolutTransactionDTO | null;
  booking: BookingProposalDTO;
  /** Écriture manuelle bexio passée par l'application. */
  bexioEntryId: string | null;
  /** Dépense bexio (« Ausgabe ») créée par l'application ou liée à la pièce. */
  bexioExpenseId: string | null;
  bookedAt: string | null;
  note: string | null;
  /** Raison donnée en ignorant la pièce. */
  ignoreReason: string | null;
}

export interface ExpenseQueryDTO {
  from?: string;
  to?: string;
  paymentAccountId?: string | "none";
  categoryId?: string | "none";
  status?: ExpenseStatusDTO;
  /** Un problème, ou `ok` (rien ne manque). */
  issue?: ExpenseIssueDTO | "ok";
  search?: string;
}

/** `POST expenses/from-transaction` : une dépense pour une transaction sans pièce. */
export interface CreateExpenseFromTransactionDTO {
  transactionId: string;
}

/** `POST expenses/from-bexio` : une dépense pour une dépense bexio. */
export interface CreateExpenseFromBexioDTO {
  bexioExpenseId: string;
}

/** `PUT expenses/{id}/receipt` : rattache une pièce (sans dépense). */
export interface LinkReceiptDTO {
  receiptId: string;
}

/** `PUT expenses/{id}/bexio` : rattache une dépense bexio existante. */
export interface LinkExpenseBexioDTO {
  bexioExpenseId: string;
}

/** `PUT expenses/{id}` : corrections de la personne qui classe. */
export interface UpdateExpenseDTO {
  date?: string | null;
  merchant?: string | null;
  description?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  cardLast4?: string | null;
  paymentAccountId?: string | null;
  categoryId?: string | null;
  debitAccountNo?: string | null;
  creditAccountNo?: string | null;
  bexioTaxId?: number | null;
  note?: string | null;
}

/** `POST expenses/{id}/match` : `null` détache. */
export interface MatchExpenseDTO {
  transactionId: string | null;
}

export interface IgnoreDTO {
  reason?: string | null;
}

export interface MatchCandidateDTO {
  transaction: RevolutTransactionDTO;
  score: number;
  reasons: string[];
}
