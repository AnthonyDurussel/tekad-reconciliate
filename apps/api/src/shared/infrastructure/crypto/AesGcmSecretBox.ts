import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

/** Ce qu'il faut pour sceller un secret gardé en base. */
export interface ISecretBox {
  seal(plain: string): string;
  /** `null` quand il a été scellé avec un autre secret, ou altéré. */
  open(sealed: string): string | null;
}

/**
 * Scelle les secrets gardés en base (AES-256-GCM : la clé API d'OpenRouter)
 * avec une clé dérivée du secret du serveur et d'un usage : un
 * export de la base seul ne les livre pas. Changer le secret du serveur les
 * rend illisibles ; il faut alors les saisir à nouveau dans l'écran
 * d'administration.
 */
export class AesGcmSecretBox implements ISecretBox {
  private readonly key: Buffer;

  constructor(serverSecret: string, purpose = "ai-provider-keys") {
    this.key = Buffer.from(
      hkdfSync("sha256", serverSecret, "tekad-reconciliate", purpose, 32),
    );
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const parts = [iv, cipher.getAuthTag(), data].map((b) =>
      b.toString("base64"),
    );
    return [VERSION, ...parts].join(":");
  }

  open(sealed: string): string | null {
    const [version, iv, tag, data] = sealed.split(":");
    if (version !== VERSION || !iv || !tag || !data) return null;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(data, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      return null;
    }
  }
}

/** Longueur minimale du secret du serveur (`SETTINGS_ENCRYPTION_KEY`). */
export const MIN_SERVER_SECRET_LENGTH = 32;

/**
 * La boîte des réglages, ou `null` sans `SETTINGS_ENCRYPTION_KEY` (ou trop
 * court) : aucune clé API ne peut alors être enregistrée — seules les
 * variables d'environnement restent possibles.
 */
export function settingsSecretBox(
  env: NodeJS.ProcessEnv = process.env,
): ISecretBox | null {
  const secret = env.SETTINGS_ENCRYPTION_KEY?.trim();
  return secret && secret.length >= MIN_SERVER_SECRET_LENGTH
    ? new AesGcmSecretBox(secret)
    : null;
}
