import type { ContainerModuleLoadOptions } from "inversify";
import { SYNC_TYPES } from "./types.sync.js";
import { PrismaSyncRunRepository } from "@/sync/infrastructure/PrismaSyncRunRepository.js";
import { SyncUseCases } from "@/sync/application/usecases/SyncUseCases.js";
import { SyncController } from "@/sync/infrastructure/SyncController.js";

export function configureSyncContainer(c: ContainerModuleLoadOptions): void {
  c.bind(SYNC_TYPES.ISyncRunRepository)
    .to(PrismaSyncRunRepository)
    .inSingletonScope();
  c.bind(SYNC_TYPES.SyncUseCases).to(SyncUseCases).inSingletonScope();
  c.bind(SYNC_TYPES.SyncController).to(SyncController).inSingletonScope();
}
