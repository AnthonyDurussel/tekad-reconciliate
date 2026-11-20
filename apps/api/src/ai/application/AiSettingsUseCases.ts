import { inject, injectable } from "inversify";
import {
  AiProviderDTO,
  type AiConnectionDTO,
  type AiConnectionTestDTO,
  type AiModelDTO,
  type AiSettingsDTO,
  type UpdateAiSettingsDTO,
} from "@repo/models";
import { ConflictError, ValidationError } from "@/shared/domain/errors.js";
import type { ISecretBox } from "@/shared/infrastructure/crypto/AesGcmSecretBox.js";
import type { User } from "@/user/domain/User.js";
import { keyHint, type OpenRouterSettings } from "@/ai/domain/aiSettings.js";
import type {
  AiSettingsRecord,
  IAiSettingsRepository,
  IAiSettingsRuntime,
  IOpenRouterClient,
} from "@/ai/application/ports.js";
import { AI_TYPES } from "@/ai/infrastructure/ioc/types.ai.js";

/** Ce que l'environnement de la Function App dit de l'IA. */
export interface AiEnvironment {
  /** `envAiSettings(process.env)` : les variables seules. */
  settings: OpenRouterSettings | null;
  /** `null` sans `SETTINGS_ENCRYPTION_KEY`. */
  box: ISecretBox | null;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : "erreur inconnue";

/**
 * Réglages de l'IA administrés (`SETTINGS_MANAGE`) : OpenRouter, Mistral OCR
 * et le modèle d'extraction. La clé API est scellée en base et jamais
 * rendue. Enregistrer, ou revenir aux variables d'environnement, s'applique
 * tout de suite sur cette instance et en 30 s au plus sur les autres.
 */
@injectable()
export class AiSettingsUseCases {
  constructor(
    @inject(AI_TYPES.IAiSettingsRepository)
    private repository: IAiSettingsRepository,
    @inject(AI_TYPES.IOpenRouterClient) private client: IOpenRouterClient,
    @inject(AI_TYPES.IAiSettingsRuntime) private runtime: IAiSettingsRuntime,
    @inject(AI_TYPES.AiEnvironment) private environment: AiEnvironment,
  ) {}

  async get(): Promise<AiSettingsDTO> {
    const record = await this.repository.find();
    const env = this.environment.settings;
    return {
      source: record ? "DATABASE" : env ? "ENVIRONMENT" : "NONE",
      active: !!(await this.runtime.current()),
      provider: AiProviderDTO.OPENROUTER,
      stored: record
        ? {
            enabled: record.enabled,
            hasApiKey: !!record.apiKeySealed,
            apiKeyHint: record.apiKeyHint,
            apiKeyUnreadable: !!record.apiKeySealed && !this.openKey(record),
            extractionModel: record.extractionModel,
            ocrEngine: record.ocrEngine,
            updatedAt: record.updatedAt.toISOString(),
            updatedByName: record.updatedByName,
          }
        : null,
      environment: env ? { model: env.model } : null,
      encryptionAvailable: !!this.environment.box,
    };
  }

  async update(user: User, body: UpdateAiSettingsDTO): Promise<AiSettingsDTO> {
    const current = await this.repository.find();
    let apiKeySealed: string;
    let apiKeyHint: string | null;
    const newKey = body.apiKey?.trim();
    if (newKey) {
      apiKeySealed = this.requireBox().seal(newKey);
      apiKeyHint = keyHint(newKey);
    } else if (current?.apiKeySealed && this.openKey(current)) {
      apiKeySealed = current.apiKeySealed;
      apiKeyHint = current.apiKeyHint;
    } else {
      throw new ValidationError("Saisissez la clé API OpenRouter");
    }
    await this.repository.save({
      enabled: body.enabled,
      apiKeySealed,
      apiKeyHint,
      extractionModel: body.extractionModel.trim(),
      ocrEngine: body.ocrEngine,
      updatedById: user.id,
      updatedByName: user.name,
    });
    this.runtime.invalidate();
    return this.get();
  }

  /** Oublie les réglages enregistrés : les variables d'environnement reprennent. */
  async reset(): Promise<AiSettingsDTO> {
    await this.repository.delete();
    this.runtime.invalidate();
    return this.get();
  }

  async listModels(body: AiConnectionDTO): Promise<AiModelDTO[]> {
    const apiKey = await this.apiKey(body);
    try {
      return await this.client.listModels(apiKey);
    } catch (error) {
      throw new ConflictError(
        `OpenRouter n'a pas listé les modèles : ${message(error)}`,
      );
    }
  }

  async test(body: AiConnectionDTO): Promise<AiConnectionTestDTO> {
    const apiKey = await this.apiKey(body);
    const model =
      body.model?.trim() ||
      (await this.repository.find())?.extractionModel ||
      this.environment.settings?.model;
    if (!model) throw new ValidationError("Choisissez un modèle");
    const started = Date.now();
    try {
      await this.client.ping(apiKey, model);
      return {
        ok: true,
        model,
        durationMs: Date.now() - started,
        message: null,
      };
    } catch (error) {
      return {
        ok: false,
        model,
        durationMs: Date.now() - started,
        message: message(error),
      };
    }
  }

  /** La clé saisie ; sinon celle enregistrée ; sinon celle de l'environnement. */
  private async apiKey(body: AiConnectionDTO): Promise<string> {
    const typed = body.apiKey?.trim();
    if (typed) return typed;
    const current = await this.repository.find();
    const stored = current ? this.openKey(current) : null;
    const key = stored ?? this.environment.settings?.apiKey;
    if (!key) throw new ValidationError("Saisissez la clé API OpenRouter");
    return key;
  }

  private openKey(record: AiSettingsRecord): string | null {
    return record.apiKeySealed && this.environment.box
      ? this.environment.box.open(record.apiKeySealed)
      : null;
  }

  private requireBox(): ISecretBox {
    if (!this.environment.box) {
      throw new ValidationError(
        "Aucune clé API ne peut être enregistrée : le secret SETTINGS_ENCRYPTION_KEY (32 caractères au moins) manque sur cet environnement. Utilisez la variable OPENROUTER_API_KEY ou faites ajouter le secret.",
      );
    }
    return this.environment.box;
  }
}
