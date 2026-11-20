import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { BexioExpenseController } from "@/bexio-expense/infrastructure/BexioExpenseController.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

const controller = (c: Container) =>
  c.get<BexioExpenseController>(BEXIO_EXPENSE_TYPES.BexioExpenseController);

/** Dépenses bexio, lues en direct. */
export function registerBexioExpenseRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "listBexioExpenses",
    methods: ["GET"],
    path: "bexio-expenses",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c, r) => controller(c).list(r),
  });
  route(app, {
    name: "getBexioExpense",
    methods: ["GET"],
    path: "bexio-expenses/{id}",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c, r) => controller(c).get(r),
  });
  route(app, {
    name: "getBexioExpenseFile",
    methods: ["GET"],
    path: "bexio-expenses/{id}/files/{uuid}",
    access: PermissionDTO.EXPENSE_VIEW,
    tx: false,
    handler: (c, r) => controller(c).file(r),
  });
}
