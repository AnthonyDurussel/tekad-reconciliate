import type { Container } from "inversify";
import type { InvocationContext, Timer } from "@azure/functions";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { withPrisma } from "@/shared/infrastructure/middleware/withTransaction.js";
import { SyncController } from "@/sync/infrastructure/SyncController.js";
import { SyncUseCases } from "@/sync/application/usecases/SyncUseCases.js";
import { SYNC_TYPES } from "@/sync/infrastructure/ioc/types.sync.js";

const controller = (c: Container) =>
  c.get<SyncController>(SYNC_TYPES.SyncController);

/** Les imports appellent bexio, Revolut et Claude : hors transaction. */
export function registerSyncRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "getSyncStatus",
    methods: ["GET"],
    path: "sync/status",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c) => controller(c).status(),
  });
  route(app, {
    name: "listSyncRuns",
    methods: ["GET"],
    path: "sync/runs",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c) => controller(c).runs(),
  });
  const post = (
    name: string,
    path: string,
    action: "bexioInbox" | "extract" | "revolut" | "match" | "all",
  ) =>
    route(app, {
      name,
      methods: ["POST"],
      path,
      access: PermissionDTO.SYNC_RUN,
      tx: false,
      handler: (c, r) => controller(c)[action](r),
    });
  post("syncBexioInbox", "sync/bexio-inbox", "bexioInbox");
  post("syncExtract", "sync/extract", "extract");
  post("syncRevolut", "sync/revolut", "revolut");
  post("syncMatch", "sync/match", "match");
  post("syncAll", "sync/all", "all");
}

/** Le sous-ensemble de `app` dont le minuteur a besoin. */
export interface TimerRegistrar {
  timer(
    name: string,
    options: {
      schedule: string;
      handler: (timer: Timer, context: InvocationContext) => Promise<void>;
    },
  ): void;
}

/** Synchronisation de nuit (05:15 UTC ; `SYNC_CRON` la déplace). */
export function registerSyncTimer(app: TimerRegistrar) {
  app.timer("nightlySync", {
    schedule: process.env.SYNC_CRON?.trim() || "0 15 5 * * *",
    handler: async (_timer, context) => {
      const runs = await withPrisma((c) =>
        c.get<SyncUseCases>(SYNC_TYPES.SyncUseCases).all(null),
      );
      for (const run of runs) {
        context.log(
          `[sync] ${run.source} ${run.success ? "ok" : "échec"} (${run.count}) ${run.message ?? ""}`,
        );
      }
    },
  });
}
