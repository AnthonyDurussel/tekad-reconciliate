import type { ExtractionDTO } from "@repo/models";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";

export interface ReceiptReadingContext {
  /** Types de dépense proposables (code + libellé). */
  categories: { code: string; label: string }[];
  /** Cartes connues : aide à lire les 4 derniers chiffres. */
  knownCards: string[];
}

/** Port de lecture d'un ticket / d'une facture. */
export interface IReceiptReader {
  /** Réglages de l'IA présents et activés (lus au moment de l'appel). */
  isConfigured(): Promise<boolean>;
  read(
    file: StoredFile,
    context: ReceiptReadingContext,
  ): Promise<ExtractionDTO>;
}
