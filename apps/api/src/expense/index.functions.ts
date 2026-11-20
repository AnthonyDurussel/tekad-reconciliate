import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpMethod,
  type HttpRouteRegistrar,
  type RouteAccess,
} from "@/shared/infrastructure/http/registerRoute.js";
import { ExpenseController } from "@/expense/infrastructure/ExpenseController.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";

const controller = (c: Container) =>
  c.get<ExpenseController>(EXPENSE_TYPES.ExpenseController);

type Action = Exclude<keyof ExpenseController, "constructor">;

export function registerExpenseRoutes(app: HttpRouteRegistrar) {
  const add = (
    name: string,
    method: HttpMethod,
    path: string,
    access: RouteAccess,
    action: Action,
    tx: boolean,
    timeout?: number,
  ) =>
    route(app, {
      name,
      methods: [method],
      path,
      access,
      tx,
      timeout,
      handler: (c, r) => controller(c)[action](r),
    });

  const VIEW = PermissionDTO.EXPENSE_VIEW;
  const MANAGE = PermissionDTO.EXPENSE_MANAGE;
  const BOOK = PermissionDTO.EXPENSE_BOOK;

  // Les routes fixes passent avant `expenses/{id}`.
  add("listExpenses", "GET", "expenses", VIEW, "list", false);
  add("exportExpenses", "GET", "expenses/export", VIEW, "export", false);
  add("getExpense", "GET", "expenses/{id}", VIEW, "get", false);
  add("getExpenseFile", "GET", "expenses/{id}/file", VIEW, "file", false);
  add(
    "getExpenseCandidates",
    "GET",
    "expenses/{id}/candidates",
    VIEW,
    "candidates",
    false,
  );
  add("updateExpense", "PUT", "expenses/{id}", MANAGE, "update", true);
  // Lecture (appel Claude) hors transaction : plusieurs secondes.
  add(
    "extractExpense",
    "POST",
    "expenses/{id}/extract",
    MANAGE,
    "extract",
    false,
  );
  add("matchExpense", "POST", "expenses/{id}/match", MANAGE, "match", true);
  add("ignoreExpense", "POST", "expenses/{id}/ignore", MANAGE, "ignore", true);
  add(
    "restoreExpense",
    "POST",
    "expenses/{id}/restore",
    MANAGE,
    "restore",
    true,
  );
  // L'écriture bexio part avant l'enregistrement : hors transaction, l'état
  // n'est écrit qu'une fois bexio d'accord.
  add("bookExpense", "POST", "expenses/{id}/book", BOOK, "book", false);
  add("unbookExpense", "POST", "expenses/{id}/unbook", BOOK, "unbook", true);
}
