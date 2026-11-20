export const SETTINGS_TYPES = {
  ISettingsRepository: Symbol.for("Settings.ISettingsRepository"),
  SettingsUseCases: Symbol.for("Settings.SettingsUseCases"),
  SettingsController: Symbol.for("Settings.SettingsController"),
} as const;
