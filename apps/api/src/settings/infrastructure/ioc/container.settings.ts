import type { ContainerModuleLoadOptions } from "inversify";
import { SETTINGS_TYPES } from "./types.settings.js";
import { PrismaSettingsRepository } from "@/settings/infrastructure/PrismaSettingsRepository.js";
import { SettingsUseCases } from "@/settings/application/usecases/SettingsUseCases.js";
import { SettingsController } from "@/settings/infrastructure/SettingsController.js";

export function configureSettingsContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(SETTINGS_TYPES.ISettingsRepository)
    .to(PrismaSettingsRepository)
    .inSingletonScope();
  c.bind(SETTINGS_TYPES.SettingsUseCases)
    .to(SettingsUseCases)
    .inSingletonScope();
  c.bind(SETTINGS_TYPES.SettingsController)
    .to(SettingsController)
    .inSingletonScope();
}
