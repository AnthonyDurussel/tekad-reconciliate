/**
 * Réglages de l'IA, administrés depuis l'écran « Intelligence artificielle »
 * (`SETTINGS_MANAGE`). Un fournisseur : **OpenRouter**. Les pièces sont lues
 * par **Mistral OCR** (plugin `file-parser` d'OpenRouter), puis un modèle de
 * langage au choix en tire les champs (sortie JSON structurée). Sans réglage
 * enregistré, les variables `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` de la
 * Function App s'appliquent.
 */

export enum AiProviderDTO {
  OPENROUTER = "OPENROUTER",
}

/** Moteur de lecture des PDF d'OpenRouter (`plugins[file-parser].pdf.engine`). */
export enum OcrEngineDTO {
  /** Mistral OCR : scans, photos, tickets (payant à la page). */
  MISTRAL_OCR = "mistral-ocr",
  /** Texte embarqué du PDF seulement (gratuit, inutile sur un scan). */
  PDF_TEXT = "pdf-text",
  /** Le modèle lit le fichier lui-même (s'il sait le faire). */
  NATIVE = "native",
}

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/** Modèle par défaut : il lit le texte rendu par Mistral OCR. */
export const DEFAULT_EXTRACTION_MODEL = "mistralai/mistral-small-3.2-24b-instruct";
export const DEFAULT_OCR_ENGINE = OcrEngineDTO.MISTRAL_OCR;

/** D'où viennent les réglages en vigueur. */
export type AiSettingsSourceDTO = "DATABASE" | "ENVIRONMENT" | "NONE";

export interface AiSettingsDTO {
  source: AiSettingsSourceDTO;
  /** La lecture des pièces répond (réglages complets et activés). */
  active: boolean;
  provider: AiProviderDTO;
  /** Les réglages enregistrés ; `null` tant que rien ne l'a été. */
  stored: {
    enabled: boolean;
    /** Une clé est enregistrée (jamais rendue). */
    hasApiKey: boolean;
    /** Ses derniers caractères, pour la reconnaître. */
    apiKeyHint: string | null;
    /** La clé enregistrée ne se déchiffre plus (secret du serveur changé). */
    apiKeyUnreadable: boolean;
    extractionModel: string;
    ocrEngine: OcrEngineDTO;
    updatedAt: string;
    updatedByName: string | null;
  } | null;
  /** Ce que disent les variables d'environnement (sans la clé). */
  environment: { model: string } | null;
  /** Une clé API peut être enregistrée (`SETTINGS_ENCRYPTION_KEY` présent). */
  encryptionAvailable: boolean;
}

export interface UpdateAiSettingsDTO {
  enabled: boolean;
  /** Absente : la clé enregistrée est gardée. */
  apiKey?: string;
  extractionModel: string;
  ocrEngine: OcrEngineDTO;
}

/** Une connexion à essayer (liste des modèles, test) avant d'enregistrer. */
export interface AiConnectionDTO {
  /** Absente : la clé enregistrée (ou celle de l'environnement). */
  apiKey?: string;
  /** Pour le test : le modèle à appeler. */
  model?: string | null;
}

/** Un modèle du catalogue OpenRouter. */
export interface AiModelDTO {
  id: string;
  name: string;
  /** Prix en USD par million de jetons (entrée / sortie), s'il est connu. */
  promptPricePerM: number | null;
  completionPricePerM: number | null;
  contextLength: number | null;
  /** Accepte une sortie JSON contrainte par schéma (`response_format`). */
  structuredOutputs: boolean;
}

export interface AiConnectionTestDTO {
  ok: boolean;
  model: string;
  durationMs: number;
  /** Le message du fournisseur en cas d'échec. */
  message: string | null;
}
