import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { RevolutController } from "@/revolut/infrastructure/RevolutController.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";

const controller = (c: Container) =>
  c.get<RevolutController>(REVOLUT_TYPES.RevolutController);

export function registerRevolutRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "listRevolutTransactions",
    methods: ["GET"],
    path: "revolut/transactions",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c, r) => controller(c).list(r),
  });
  route(app, {
    name: "ignoreRevolutTransaction",
    methods: ["POST"],
    path: "revolut/transactions/{id}/ignore",
    access: PermissionDTO.EXPENSE_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).ignore(r),
  });
  route(app, {
    name: "restoreRevolutTransaction",
    methods: ["POST"],
    path: "revolut/transactions/{id}/restore",
    access: PermissionDTO.EXPENSE_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).restore(r),
  });
}
