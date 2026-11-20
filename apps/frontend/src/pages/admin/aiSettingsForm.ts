import {
  DEFAULT_EXTRACTION_MODEL,
  DEFAULT_OCR_ENGINE,
  type AiModelDTO,
  type AiSettingsDTO,
  type OcrEngineDTO,
  type UpdateAiSettingsDTO,
} from "@repo/models";

export interface AiSettingsFormValues {
  enabled: boolean;
  /** Vide : la clé enregistrée est gardée. */
  apiKey: string;
  extractionModel: string;
  ocrEngine: OcrEngineDTO;
}

/** Les valeurs du formulaire : enregistrées, sinon celles de l'environnement. */
export function initialValues(
  settings: AiSettingsDTO | undefined,
): AiSettingsFormValues {
  const stored = settings?.stored;
  return {
    enabled: stored?.enabled ?? true,
    apiKey: "",
    extractionModel:
      stored?.extractionModel ??
      settings?.environment?.model ??
      DEFAULT_EXTRACTION_MODEL,
    ocrEngine: stored?.ocrEngine ?? DEFAULT_OCR_ENGINE,
  };
}

export function toUpdateBody(v: AiSettingsFormValues): UpdateAiSettingsDTO {
  return {
    enabled: v.enabled,
    ...(v.apiKey.trim() ? { apiKey: v.apiKey.trim() } : {}),
    extractionModel: v.extractionModel.trim(),
    ocrEngine: v.ocrEngine,
  };
}

/** « 0.10 $ / 0.30 $ par million de jetons » ; gratuit ; inconnu. */
export function priceLabel(m: AiModelDTO): string | null {
  if (m.promptPricePerM === null || m.completionPricePerM === null) return null;
  if (m.promptPricePerM === 0 && m.completionPricePerM === 0) return "gratuit";
  return `${m.promptPricePerM} $ / ${m.completionPricePerM} $`;
}

/** Les modèles proposés : sortie JSON d'abord, puis Mistral, puis l'ordre alphabétique. */
export function sortModels(models: AiModelDTO[]): AiModelDTO[] {
  const rank = (m: AiModelDTO) =>
    (m.structuredOutputs ? 0 : 2) + (m.id.startsWith("mistralai/") ? 0 : 1);
  return [...models].sort(
    (a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
}
