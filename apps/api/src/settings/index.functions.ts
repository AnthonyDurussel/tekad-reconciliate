import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { SettingsController } from "@/settings/infrastructure/SettingsController.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

const controller = (c: Container) =>
  c.get<SettingsController>(SETTINGS_TYPES.SettingsController);

const READ = [PermissionDTO.EXPENSE_VIEW, PermissionDTO.SETTINGS_MANAGE];

export function registerSettingsRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "listPaymentAccounts",
    methods: ["GET"],
    path: "payment-accounts",
    access: READ,
    tx: false,
    handler: (c) => controller(c).listPaymentAccounts(),
  });
  route(app, {
    name: "createPaymentAccount",
    methods: ["POST"],
    path: "payment-accounts",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).createPaymentAccount(r),
  });
  route(app, {
    name: "updatePaymentAccount",
    methods: ["PUT"],
    path: "payment-accounts/{id}",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).updatePaymentAccount(r),
  });
  route(app, {
    name: "deletePaymentAccount",
    methods: ["DELETE"],
    path: "payment-accounts/{id}",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).deletePaymentAccount(r),
  });

  route(app, {
    name: "listExpenseCategories",
    methods: ["GET"],
    path: "expense-categories",
    access: READ,
    tx: false,
    handler: (c) => controller(c).listCategories(),
  });
  route(app, {
    name: "createExpenseCategory",
    methods: ["POST"],
    path: "expense-categories",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).createCategory(r),
  });
  route(app, {
    name: "updateExpenseCategory",
    methods: ["PUT"],
    path: "expense-categories/{id}",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).updateCategory(r),
  });
  route(app, {
    name: "deleteExpenseCategory",
    methods: ["DELETE"],
    path: "expense-categories/{id}",
    access: PermissionDTO.SETTINGS_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).deleteCategory(r),
  });
}
