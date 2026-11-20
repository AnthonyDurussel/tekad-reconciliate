import type { PrismaClient } from "@generated/prisma/client.js";
import {
  publicRoute,
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { backendInfo } from "@/config/application/backendInfo.js";

export function registerConfigRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "getBackendInfo",
    methods: ["GET"],
    path: "config/backend",
    access: "AUTHENTICATED",
    tx: false,
    handler: async () => ok(backendInfo()),
  });

  /**
   * Santé, publique : le test de disponibilité d'Azure Monitor et la fin du
   * déploiement (`deploy.sh` attend que la nouvelle version réponde). Ne dit
   * rien d'autre que la version et si la base répond — 503 sinon, avec le
   * même corps.
   */
  publicRoute(app, {
    name: "health",
    methods: ["GET"],
    path: "health",
    tx: false,
    handler: async (container) => {
      const { version, commit, environment } = backendInfo();
      let database = "ok";
      try {
        await container.get<PrismaClient>("PrismaClient").$queryRaw`SELECT 1`;
      } catch {
        database = "error";
      }
      const status = database === "ok" ? "ok" : "degraded";
      return {
        status: status === "ok" ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
        jsonBody: { status, version, commit, environment, database },
      };
    },
  });
}
