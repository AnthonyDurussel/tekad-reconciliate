import type { ContainerModuleLoadOptions } from "inversify";
import { DASHBOARD_TYPES } from "./types.dashboard.js";
import { DashboardUseCases } from "@/dashboard/application/DashboardUseCases.js";

export function configureDashboardContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(DASHBOARD_TYPES.DashboardUseCases)
    .to(DashboardUseCases)
    .inSingletonScope();
}
