import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { queryPeriod } from "@/shared/infrastructure/http/period.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { DashboardUseCases } from "@/dashboard/application/DashboardUseCases.js";
import { DASHBOARD_TYPES } from "@/dashboard/infrastructure/ioc/types.dashboard.js";

export function registerDashboardRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "getDashboard",
    methods: ["GET"],
    path: "dashboard",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: async (c, r) => {
      const { from, to } = queryPeriod(r);
      return ok(
        await c
          .get<DashboardUseCases>(DASHBOARD_TYPES.DashboardUseCases)
          .dashboard(from, to),
      );
    },
  });
}
