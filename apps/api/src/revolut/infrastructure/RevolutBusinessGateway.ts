import { createSign } from "node:crypto";
import { ConflictError, InternalServerError } from "@/shared/domain/errors.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type { IRevolutGateway } from "@/revolut/application/ports/IRevolutGateway.js";
import type { RevolutApiTransaction } from "@/revolut/domain/RevolutTransaction.js";

export interface RevolutConfig {
  apiUrl: string;
  clientId: string;
  /** Clé privée PEM du certificat chargé dans Revolut Business. */
  privateKey: string;
  /** Domaine de l'URI de redirection déclarée avec le certificat. */
  issuer: string;
  refreshToken: string;
}

const PAGE = 1000;

const b64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** JWT d'assertion client (RS256) exigé par `POST /auth/token`. */
export function clientAssertion(
  config: Pick<RevolutConfig, "clientId" | "privateKey" | "issuer">,
  now = Date.now(),
): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: config.issuer,
      sub: config.clientId,
      aud: "https://revolut.com",
      exp: Math.floor(now / 1000) + 300,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${b64url(signer.sign(config.privateKey))}`;
}

/**
 * Adaptateur Revolut Business API (`/api/1.0`). Le jeton d'accès (40 min) se
 * renouvelle par le jeton de rafraîchissement et une assertion signée par la
 * clé privée du certificat. Les transactions arrivent du plus récent au plus
 * ancien, 1000 au plus par page : on recule `to` jusqu'à `from`.
 */
export class RevolutBusinessGateway implements IRevolutGateway {
  readonly configured = true;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private config: RevolutConfig,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion(this.config),
    });
    const response = await this.fetchImpl(`${this.config.apiUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      log.error(
        `[revolut] auth/token → ${response.status} ${await response.text().catch(() => "")}`,
      );
      throw new InternalServerError(
        `Revolut a refusé le jeton (${response.status})`,
      );
    }
    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  async listTransactions(
    from: Date,
    to: Date,
  ): Promise<RevolutApiTransaction[]> {
    const token = await this.accessToken();
    const all = new Map<string, RevolutApiTransaction>();
    let upper = to;
    for (;;) {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: upper.toISOString(),
        count: String(PAGE),
      });
      const response = await this.fetchImpl(
        `${this.config.apiUrl}/transactions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) {
        log.error(`[revolut] transactions → ${response.status}`);
        throw new InternalServerError(`Revolut a répondu ${response.status}`);
      }
      const page = (await response.json()) as RevolutApiTransaction[];
      for (const tx of page) all.set(tx.id, tx);
      if (page.length < PAGE) break;
      const oldest = page[page.length - 1].created_at;
      const next = new Date(oldest);
      if (!(next < upper)) break;
      upper = next;
    }
    return [...all.values()];
  }
}

export class UnconfiguredRevolutGateway implements IRevolutGateway {
  readonly configured = false;
  listTransactions(): Promise<RevolutApiTransaction[]> {
    throw new ConflictError(
      "Revolut Business n'est pas configuré (REVOLUT_CLIENT_ID, REVOLUT_PRIVATE_KEY, REVOLUT_ISSUER, REVOLUT_REFRESH_TOKEN)",
    );
  }
}

export function createRevolutGateway(
  env: NodeJS.ProcessEnv = process.env,
): IRevolutGateway {
  const clientId = env.REVOLUT_CLIENT_ID?.trim();
  const privateKey = env.REVOLUT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const issuer = env.REVOLUT_ISSUER?.trim();
  const refreshToken = env.REVOLUT_REFRESH_TOKEN?.trim();
  if (!clientId || !privateKey || !issuer || !refreshToken) {
    return new UnconfiguredRevolutGateway();
  }
  return new RevolutBusinessGateway({
    apiUrl: env.REVOLUT_API_URL?.trim() || "https://b2b.revolut.com/api/1.0",
    clientId,
    privateKey,
    issuer,
    refreshToken,
  });
}

let shared: IRevolutGateway | null = null;

/** Une instance par processus : le jeton d'accès se garde entre requêtes. */
export function sharedRevolutGateway(): IRevolutGateway {
  shared ??= createRevolutGateway();
  return shared;
}
