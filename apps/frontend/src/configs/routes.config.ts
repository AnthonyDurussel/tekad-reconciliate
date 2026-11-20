import { lazy } from "react";
import { PermissionDTO } from "@repo/models";
import type { Route } from "@/@types/routes";

export const protectedRoutes: Route[] = [
  {
    key: "dashboard",
    path: "/dashboard",
    component: lazy(() => import("@/pages/dashboard/DashboardPage")),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "expenses",
    path: "/expenses",
    component: lazy(() => import("@/pages/expenses/ExpensesPage")),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "expenseDetail",
    path: "/expenses/:id",
    component: lazy(() => import("@/pages/expenses/ExpenseDetailPage")),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "bexioExpenses",
    path: "/bexio-expenses",
    component: lazy(() => import("@/pages/bexio-expenses/BexioExpensesPage")),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "bexioExpenseDetail",
    path: "/bexio-expenses/:id",
    component: lazy(
      () => import("@/pages/bexio-expenses/BexioExpenseDetailPage"),
    ),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "revolut",
    path: "/revolut",
    component: lazy(() => import("@/pages/revolut/RevolutPage")),
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "adminAccounts",
    path: "/admin/accounts",
    component: lazy(() => import("@/pages/admin/PaymentAccountsPage")),
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminCategories",
    path: "/admin/categories",
    component: lazy(() => import("@/pages/admin/ExpenseCategoriesPage")),
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminAi",
    path: "/admin/ai",
    component: lazy(() => import("@/pages/admin/AiSettingsPage")),
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminUsers",
    path: "/admin/users",
    component: lazy(() => import("@/pages/admin/UsersPage")),
    permissions: [PermissionDTO.USER_MANAGE],
  },
];

export const publicRoutes: Route[] = [
  {
    key: "login",
    path: "/public/log-in",
    component: lazy(() => import("@/pages/public/LoginPage")),
  },
  {
    key: "accessDenied",
    path: "/public/access-denied",
    component: lazy(() => import("@/pages/public/AccessDeniedPage")),
  },
];

/** Pages rendues sans la coquille (navigation). */
export const blankLayoutPaths = ["/public/*"];
