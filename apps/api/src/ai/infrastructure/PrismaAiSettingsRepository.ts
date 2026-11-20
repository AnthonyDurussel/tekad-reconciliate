import { inject, injectable } from "inversify";
import type { PrismaClient } from "@generated/prisma/client.js";
import type { ISecretBox } from "@/shared/infrastructure/crypto/AesGcmSecretBox.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import {
  readOcrEngine,
  type OpenRouterSettings,
} from "@/ai/domain/aiSettings.js";
import type {
  AiSettingsRecord,
  IAiSettingsRepository,
} from "@/ai/application/ports.js";

const ID = "default";

type Row = {
  enabled: boolean;
  api_key_sealed: string | null;
  api_key_hint: string | null;
  extraction_model: string;
  ocr_engine: string;
  updated_at: Date;
  updated_by_id: string | null;
  updated_by_name: string | null;
};

const toRecord = (r: Row): AiSettingsRecord => ({
  enabled: r.enabled,
  apiKeySealed: r.api_key_sealed,
  apiKeyHint: r.api_key_hint,
  extractionModel: r.extraction_model,
  ocrEngine: readOcrEngine(r.ocr_engine),
  updatedAt: r.updated_at,
  updatedById: r.updated_by_id,
  updatedByName: r.updated_by_name,
});

@injectable()
export class PrismaAiSettingsRepository implements IAiSettingsRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async find(): Promise<AiSettingsRecord | null> {
    const row = await this.prisma.aiSettingsDB.findUnique({
      where: { id: ID },
    });
    return row ? toRecord(row) : null;
  }

  async save(record: Omit<AiSettingsRecord, "updatedAt">): Promise<void> {
    const data = {
      enabled: record.enabled,
      provider: "OPENROUTER",
      api_key_sealed: record.apiKeySealed,
      api_key_hint: record.apiKeyHint,
      extraction_model: record.extractionModel,
      ocr_engine: record.ocrEngine,
      updated_by_id: record.updatedById,
      updated_by_name: record.updatedByName,
    };
    await this.prisma.aiSettingsDB.upsert({
      where: { id: ID },
      create: { id: ID, ...data },
      update: data,
    });
  }

  async delete(): Promise<void> {
    await this.prisma.aiSettingsDB.deleteMany({ where: { id: ID } });
  }
}

/**
 * Les réglages enregistrés, prêts pour l'adaptateur (clé ouverte) :
 * `undefined` sans ligne (les variables d'environnement s'appliquent).
 * Désactivés, ou une clé qui ne s'ouvre plus : `null`, l'IA est coupée — pas
 * renvoyée en douce vers les variables.
 */
export async function readStoredAiSettings(
  prisma: PrismaClient,
  box: ISecretBox | null,
): Promise<OpenRouterSettings | null | undefined> {
  const row = await prisma.aiSettingsDB.findUnique({ where: { id: ID } });
  if (!row) return undefined;
  const record = toRecord(row);
  if (!record.enabled) return null;
  const apiKey =
    record.apiKeySealed && box ? box.open(record.apiKeySealed) : null;
  if (!apiKey) {
    log.warn(
      "[ai] la clé OpenRouter enregistrée ne s'ouvre pas (SETTINGS_ENCRYPTION_KEY absent ou changé) : IA coupée",
    );
    return null;
  }
  return { apiKey, model: record.extractionModel, ocrEngine: record.ocrEngine };
}
