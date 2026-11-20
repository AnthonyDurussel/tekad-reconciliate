import { afterEach, describe, expect, it } from "vitest";
import { GraphEntraDirectory } from "@/user/infrastructure/GraphEntraDirectory.js";

const KEYS = [
  "ENTRA_TENANT_ID",
  "ENTRA_APP_CLIENT_ID",
  "ENTRA_GRAPH_CLIENT_ID",
  "ENTRA_GRAPH_CLIENT_SECRET",
];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("configuration Graph", () => {
  it("connexion seule (tenant + App Registration) : vérification hors service", () => {
    process.env.ENTRA_TENANT_ID = "t";
    process.env.ENTRA_APP_CLIENT_ID = "app";
    delete process.env.ENTRA_GRAPH_CLIENT_ID;
    delete process.env.ENTRA_GRAPH_CLIENT_SECRET;
    expect(new GraphEntraDirectory().isConfigured()).toBe(false);
  });

  it("App Registration Graph partielle : refusée", () => {
    process.env.ENTRA_TENANT_ID = "t";
    process.env.ENTRA_APP_CLIENT_ID = "app";
    process.env.ENTRA_GRAPH_CLIENT_ID = "graph";
    delete process.env.ENTRA_GRAPH_CLIENT_SECRET;
    expect(() => new GraphEntraDirectory().isConfigured()).toThrow(
      /ENTRA_GRAPH_CLIENT_SECRET/,
    );
  });

  it("les quatre réglages : en service", () => {
    process.env.ENTRA_TENANT_ID = "t";
    process.env.ENTRA_APP_CLIENT_ID = "app";
    process.env.ENTRA_GRAPH_CLIENT_ID = "graph";
    process.env.ENTRA_GRAPH_CLIENT_SECRET = "s";
    expect(new GraphEntraDirectory().isConfigured()).toBe(true);
  });
});
