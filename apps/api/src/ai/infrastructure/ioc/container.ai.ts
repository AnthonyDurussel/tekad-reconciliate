import type { ContainerModuleLoadOptions } from "inversify";
import { AI_TYPES } from "./types.ai.js";
import { settingsSecretBox } from "@/shared/infrastructure/crypto/AesGcmSecretBox.js";
import { envAiSettings } from "@/ai/domain/aiSettings.js";
import { aiRuntime } from "@/ai/infrastructure/aiRuntime.js";
import { OpenRouterClient } from "@/ai/infrastructure/OpenRouterClient.js";
import { PrismaAiSettingsRepository } from "@/ai/infrastructure/PrismaAiSettingsRepository.js";
import {
  AiSettingsUseCases,
  type AiEnvironment,
} from "@/ai/application/AiSettingsUseCases.js";
import { AiSettingsController } from "@/ai/infrastructure/AiSettingsController.js";

export function configureAiContainer(c: ContainerModuleLoadOptions): void {
  c.bind(AI_TYPES.IAiSettingsRepository)
    .to(PrismaAiSettingsRepository)
    .inSingletonScope();
  c.bind(AI_TYPES.IOpenRouterClient).toDynamicValue(
    () => new OpenRouterClient(),
  );
  c.bind(AI_TYPES.IAiSettingsRuntime).toDynamicValue(() => aiRuntime());
  c.bind<AiEnvironment>(AI_TYPES.AiEnvironment).toDynamicValue(() => ({
    settings: envAiSettings(),
    box: settingsSecretBox(),
  }));
  c.bind(AI_TYPES.AiSettingsUseCases).to(AiSettingsUseCases).inSingletonScope();
  c.bind(AI_TYPES.AiSettingsController)
    .to(AiSettingsController)
    .inSingletonScope();
}
