import type { IAiSettingsRuntime } from "@/ai/application/ports.js";
import {
  envAiSettings,
  type OpenRouterSettings,
} from "@/ai/domain/aiSettings.js";

/** Les réglages enregistrés : `undefined` sans ligne, `null` IA coupée. */
export type StoredAiSettingsReader = () => Promise<
  OpenRouterSettings | null | undefined
>;

/** Un réglage enregistré sur une autre instance s'applique dans ce délai. */
export const AI_SETTINGS_TTL_MS = 30_000;

/**
 * Les réglages de l'IA en vigueur pour cette instance de Function App :
 * relus en base au plus toutes les 30 s, tout de suite après un
 * enregistrement sur cette instance ; sans ligne, les variables
 * `OPENROUTER_*`.
 */
export class AiRuntime implements IAiSettingsRuntime {
  private cache: {
    at: number;
    value: Promise<OpenRouterSettings | null>;
  } | null = null;

  constructor(
    private readStored: StoredAiSettingsReader,
    private env: NodeJS.ProcessEnv = process.env,
    private clock: () => number = Date.now,
  ) {}

  current(): Promise<OpenRouterSettings | null> {
    const now = this.clock();
    if (!this.cache || now - this.cache.at > AI_SETTINGS_TTL_MS) {
      const value = this.readStored().then((stored) =>
        stored === undefined ? envAiSettings(this.env) : stored,
      );
      // Une lecture ratée n'est pas gardée : la suivante réessaie.
      value.catch(() => {
        if (this.cache?.value === value) this.cache = null;
      });
      this.cache = { at: now, value };
    }
    return this.cache.value;
  }

  invalidate(): void {
    this.cache = null;
  }
}

let shared: AiRuntime | null = null;

/** Le runtime de l'instance (réglages lus avec le client Prisma partagé). */
export function aiRuntime(): AiRuntime {
  return (shared ??= new AiRuntime(async () => {
    const [{ prisma }, { readStoredAiSettings }, { settingsSecretBox }] =
      await Promise.all([
        import("@/shared/infrastructure/prismaClient.js"),
        import("@/ai/infrastructure/PrismaAiSettingsRepository.js"),
        import("@/shared/infrastructure/crypto/AesGcmSecretBox.js"),
      ]);
    return readStoredAiSettings(prisma, settingsSecretBox());
  }));
}
