import { describe, expect, it, vi } from "vitest";
import {
  databasePoolConfig,
  entraPasswordProvider,
} from "@/shared/infrastructure/databaseConnection.js";

describe("databasePoolConfig", () => {
  it("garde la chaîne à mot de passe hors Azure", () => {
    expect(
      databasePoolConfig({
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
        DATABASE_POOL_MAX: 7,
      }),
    ).toEqual({
      connectionString: "postgresql://u:p@localhost:5432/db",
      max: 7,
    });
  });

  it("se connecte avec l'identité managée quand DATABASE_ENTRA_URL est posé", async () => {
    const getToken = vi.fn().mockResolvedValue({
      token: "jeton",
      expiresOnTimestamp: Date.now() + 3_600_000,
    });
    const config = databasePoolConfig(
      {
        DATABASE_URL: "postgresql://ignored@x/y",
        DATABASE_ENTRA_URL:
          "postgresql://func-tekad-reconciliate-abc@psql.postgres.database.azure.com:5432/tekad",
        DATABASE_POOL_MAX: 5,
      },
      async () => ({ getToken }),
    );
    expect(config).toMatchObject({
      host: "psql.postgres.database.azure.com",
      port: 5432,
      user: "func-tekad-reconciliate-abc",
      database: "tekad",
      max: 5,
    });
    expect(config.connectionString).toBeUndefined();
    const password = config.password as () => Promise<string>;
    expect(await password()).toBe("jeton");
  });
});

describe("entraPasswordProvider", () => {
  it("réutilise le jeton puis le renouvelle 5 minutes avant son expiration", async () => {
    let now = 0;
    const getToken = vi
      .fn()
      .mockResolvedValueOnce({ token: "a", expiresOnTimestamp: 60 * 60_000 })
      .mockResolvedValueOnce({ token: "b", expiresOnTimestamp: 120 * 60_000 });
    const provider = entraPasswordProvider(
      async () => ({ getToken }),
      () => now,
    );
    expect(await provider()).toBe("a");
    now = 50 * 60_000;
    expect(await provider()).toBe("a");
    now = 56 * 60_000;
    expect(await provider()).toBe("b");
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});
