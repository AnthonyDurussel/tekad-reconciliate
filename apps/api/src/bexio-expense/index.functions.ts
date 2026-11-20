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

/** Dépenses bexio. Le lien d'une pièce écrit dans bexio : hors transaction. */
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
    name: "linkBexioExpense",
    methods: ["POST"],
    path: "bexio-expenses/{id}/link",
    access: PermissionDTO.EXPENSE_MANAGE,
    tx: false,
    handler: (c, r) => controller(c).link(r),
  });
  route(app, {
    name: "unlinkBexioExpense",
    methods: ["POST"],
    path: "bexio-expenses/{id}/unlink",
    access: PermissionDTO.EXPENSE_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).unlink(r),
  });
}
