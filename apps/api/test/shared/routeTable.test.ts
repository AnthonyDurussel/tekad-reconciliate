import { beforeAll, describe, expect, it } from "vitest";
import {
  PermissionDTO,
  ROLE_PERMISSIONS,
  RoleDTO,
  hasAnyPermission,
} from "@repo/models";
import { registerAllRoutes } from "@/routes.js";
import {
  PUBLIC_ROUTES,
  ROUTE_ACCESS,
  type RouteAccess,
} from "@/shared/infrastructure/http/registerRoute.js";

const registered: { name: string; methods: string[]; route: string }[] = [];

beforeAll(() => {
  registerAllRoutes({
    http(name, options) {
      registered.push({
        name,
        methods: (options.methods ?? []) as string[],
        route: options.route ?? "",
      });
    },
  });
});

const reaches = (role: RoleDTO, access: RouteAccess) =>
  access === "AUTHENTICATED" ||
  hasAnyPermission(
    ROLE_PERMISSIONS[role],
    Array.isArray(access) ? access : [access],
  );

describe("table des routes", () => {
  it("chaque route déclare son accès, ou est publique", () => {
    expect(registered.length).toBeGreaterThan(25);
    for (const { name } of registered) {
      expect(ROUTE_ACCESS.has(name) || PUBLIC_ROUTES.has(name), name).toBe(
        true,
      );
    }
  });

  it("seuls l'extracteur de rôles et la santé sont publics", () => {
    expect([...PUBLIC_ROUTES].sort()).toEqual(["health", "rolesExtractor"]);
  });

  it("noms de fonctions et couples méthode/chemin uniques", () => {
    const names = registered.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    const keys = registered.flatMap((r) =>
      r.methods.map((m) => `${m} ${r.route}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("un compte en lecture seule n'écrit que ses préférences", () => {
    const writes = registered.filter(
      (r) =>
        r.methods.some((m) => m !== "GET") &&
        ROUTE_ACCESS.has(r.name) &&
        reaches(RoleDTO.VIEWER, ROUTE_ACCESS.get(r.name)!),
    );
    expect(writes.map((r) => r.name)).toEqual(["updateMyPreferences"]);
  });

  it("comptabiliser et synchroniser : comptable et admin, jamais le paramétrage", () => {
    for (const name of ["bookExpense", "unbookExpense", "syncAll", "importRevolutStatement"]) {
      expect(reaches(RoleDTO.ACCOUNTANT, ROUTE_ACCESS.get(name)!), name).toBe(true);
      expect(reaches(RoleDTO.VIEWER, ROUTE_ACCESS.get(name)!), name).toBe(false);
    }
    for (const name of ["createPaymentAccount", "updateExpenseCategory"]) {
      expect(ROUTE_ACCESS.get(name)).toBe(PermissionDTO.SETTINGS_MANAGE);
      expect(reaches(RoleDTO.ACCOUNTANT, ROUTE_ACCESS.get(name)!)).toBe(false);
    }
  });

  it("la gestion des comptes est réservée à USER_MANAGE", () => {
    for (const name of ["listUsers", "createUser", "updateUser"]) {
      expect(ROUTE_ACCESS.get(name)).toBe(PermissionDTO.USER_MANAGE);
    }
  });
});
