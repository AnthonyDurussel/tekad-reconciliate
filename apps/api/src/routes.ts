import type { HttpRouteRegistrar } from "@/shared/infrastructure/http/registerRoute.js";
import { registerUserRoutes } from "@/user/index.functions.js";
import { registerConfigRoutes } from "@/config/index.functions.js";
import { registerSettingsRoutes } from "@/settings/index.functions.js";
import { registerExpenseRoutes } from "@/expense/index.functions.js";
import { registerRevolutRoutes } from "@/revolut/index.functions.js";
import { registerSyncRoutes } from "@/sync/index.functions.js";
import { registerAiRoutes } from "@/ai/index.functions.js";
import { registerDashboardRoutes } from "@/dashboard/index.functions.js";

/** Toutes les routes HTTP de l'application (aussi lu par le test de la table). */
export function registerAllRoutes(app: HttpRouteRegistrar): void {
  registerUserRoutes(app);
  registerConfigRoutes(app);
  registerSettingsRoutes(app);
  registerExpenseRoutes(app);
  registerRevolutRoutes(app);
  registerSyncRoutes(app);
  registerDashboardRoutes(app);
  registerAiRoutes(app);
}
