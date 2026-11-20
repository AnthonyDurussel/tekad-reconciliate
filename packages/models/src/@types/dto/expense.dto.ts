import type { BookingModeDTO } from "./settings.dto.js";
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

export interface ExpenseDTO {
  id: string;
  status: ExpenseStatusDTO;
  bexioFileId: string;
  fileName: string;
  mimeType: string | null;
  importedAt: string;

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
  search?: string;
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
