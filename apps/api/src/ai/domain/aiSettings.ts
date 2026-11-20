import {
  DEFAULT_EXTRACTION_MODEL,
  DEFAULT_OCR_ENGINE,
  OcrEngineDTO,
} from "@repo/models";

/**
 * Réglages de l'IA en vigueur : la clé OpenRouter, le modèle qui tire les
 * champs de la pièce et le moteur de lecture (Mistral OCR par défaut).
 * `null` : rien de configuré, la lecture des pièces est coupée.
 */
export interface OpenRouterSettings {
  apiKey: string;
  model: string;
  ocrEngine: OcrEngineDTO;
}

/** Les réglages des variables d'environnement seules. */
export function envAiSettings(
  env: NodeJS.ProcessEnv = process.env,
): OpenRouterSettings | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.OPENROUTER_MODEL?.trim() || DEFAULT_EXTRACTION_MODEL,
    ocrEngine: readOcrEngine(env.OPENROUTER_OCR_ENGINE),
  };
}

export function readOcrEngine(value: string | null | undefined): OcrEngineDTO {
  return (Object.values(OcrEngineDTO) as string[]).includes(value ?? "")
    ? (value as OcrEngineDTO)
    : DEFAULT_OCR_ENGINE;
}

/** Les derniers caractères d'une clé, pour la reconnaître sans la montrer. */
export const keyHint = (apiKey: string) => `…${apiKey.slice(-4)}`;
