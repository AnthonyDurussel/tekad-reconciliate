/// <reference types="vite/client" />
import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Container } from "inversify";
import { createRequestContainer } from "@/shared/infrastructure/ioc/requestContainer.js";

const typeModules = import.meta.glob<Record<string, unknown>>(
  "../../src/**/infrastructure/ioc/types.*.ts",
  { eager: true },
);

/** Tous les identifiants déclarés dans les `*_TYPES` des modules. */
function allServiceIds(): symbol[] {
  return Object.values(typeModules).flatMap((module) =>
    Object.values(module).flatMap((types) =>
      types && typeof types === "object"
        ? Object.values(types).filter((v): v is symbol => typeof v === "symbol")
        : [],
    ),
  );
}

describe("conteneur de requête", () => {
  it("résout chaque service déclaré dans les *_TYPES des modules", () => {
    const ids = allServiceIds();
    expect(ids.length).toBeGreaterThan(12);
    const requestContainer = createRequestContainer(
      new Container(),
      {} as never,
    );
    const unresolved = ids.filter((id) => {
      try {
        return requestContainer.get(id) === undefined;
      } catch (error) {
        return (error as Error).message.length > 0;
      }
    });
    expect(unresolved.map((id) => id.description)).toEqual([]);
  });
});
