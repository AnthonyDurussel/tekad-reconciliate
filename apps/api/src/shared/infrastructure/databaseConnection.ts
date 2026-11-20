import type { TokenCredential } from "@azure/core-auth";
import type { PoolConfig } from "pg";

/** Entra ID scope of Azure Database for PostgreSQL. */
const POSTGRES_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";
/** A token is renewed this long before it expires. */
const RENEW_BEFORE_MS = 5 * 60_000;

export interface DatabaseSettings {
  /** Password URL (local, tests, scripts, migrations). */
  DATABASE_URL?: string | undefined;
  /**
   * `postgresql://<role>@<host>:5432/<db>` without password (Azure, set by infra/main.bicep): the
   * Function App signs in with its managed identity, an Entra token as each new connection's
   * password. Takes precedence over DATABASE_URL.
   */
  DATABASE_ENTRA_URL?: string | undefined;
  /** Connections per instance: Azure Functions scales out, the server's limit is shared. */
  DATABASE_POOL_MAX: number;
}

/**
 * Pool settings of the Prisma pg adapter. With DATABASE_ENTRA_URL, the URL is split into fields
 * (a connection string's empty password would win over the token provider) and the password is
 * a function pg calls for every new connection.
 */
export function databasePoolConfig(
  settings: DatabaseSettings,
  credential?: () => Promise<TokenCredential>,
): PoolConfig {
  const max = settings.DATABASE_POOL_MAX;
  if (!settings.DATABASE_ENTRA_URL) {
    return { connectionString: settings.DATABASE_URL, max };
  }
  const url = new URL(settings.DATABASE_ENTRA_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { rejectUnauthorized: true },
    max,
    password: entraPasswordProvider(credential ?? defaultCredential),
  };
}

async function defaultCredential(): Promise<TokenCredential> {
  const { DefaultAzureCredential } = await import("@azure/identity");
  return new DefaultAzureCredential();
}

/** The current token, fetched again once it is within RENEW_BEFORE_MS of its expiry. */
export function entraPasswordProvider(
  credential: () => Promise<TokenCredential>,
  now: () => number = Date.now,
): () => Promise<string> {
  let cached: { token: string; expiresOn: number } | null = null;
  let source: TokenCredential | null = null;
  return async () => {
    if (cached && cached.expiresOn - RENEW_BEFORE_MS > now())
      return cached.token;
    source ??= await credential();
    const access = await source.getToken(POSTGRES_SCOPE);
    if (!access) throw new Error("No Entra token for PostgreSQL");
    cached = { token: access.token, expiresOn: access.expiresOnTimestamp };
    return cached.token;
  };
}
