import type { AiModelDTO, OcrEngineDTO } from "@repo/models";
import type { OpenRouterSettings } from "@/ai/domain/aiSettings.js";

/** La ligne `ai_settings`, clé scellée. */
export interface AiSettingsRecord {
  enabled: boolean;
  apiKeySealed: string | null;
  apiKeyHint: string | null;
  extractionModel: string;
  ocrEngine: OcrEngineDTO;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
}

export interface IAiSettingsRepository {
  find(): Promise<AiSettingsRecord | null>;
  save(record: Omit<AiSettingsRecord, "updatedAt">): Promise<void>;
  /** Retour aux variables d'environnement. */
  delete(): Promise<void>;
}

/** OpenRouter. Lève une `Error` lisible en cas d'échec. */
export interface IOpenRouterClient {
  listModels(apiKey: string): Promise<AiModelDTO[]>;
  /** Un appel minimal au modèle : rend s'il répond. */
  ping(apiKey: string, model: string): Promise<void>;
}

/** Les réglages en vigueur sur l'instance (cache court, invalidé à l'enregistrement). */
export interface IAiSettingsRuntime {
  current(): Promise<OpenRouterSettings | null>;
  invalidate(): void;
}
