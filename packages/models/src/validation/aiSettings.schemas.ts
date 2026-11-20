import { boolean, mixed, string, type ObjectSchema } from "yup";
import {
  OcrEngineDTO,
  type AiConnectionDTO,
  type UpdateAiSettingsDTO,
} from "../@types/dto/aiSettings.dto.js";
import { strictObject } from "./common.schemas.js";

const apiKey = () => string().trim().min(8).max(500).optional();
/** Identifiant OpenRouter : `fournisseur/modèle[:variante]`. */
const modelId = () =>
  string()
    .trim()
    .max(120)
    .matches(/^~?[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9._:-]+$/, "modèle attendu au format fournisseur/modèle");

export const updateAiSettingsSchema: ObjectSchema<UpdateAiSettingsDTO> =
  strictObject({
    enabled: boolean().required(),
    apiKey: apiKey(),
    extractionModel: modelId().required(),
    ocrEngine: mixed<OcrEngineDTO>().oneOf(Object.values(OcrEngineDTO)).required(),
  });

export const aiConnectionSchema: ObjectSchema<AiConnectionDTO> = strictObject({
  apiKey: apiKey(),
  model: modelId().nullable().optional(),
});
