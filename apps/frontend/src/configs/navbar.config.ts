import {
  IconBuildingBank,
  IconCategory,
  IconCreditCard,
  IconLayoutDashboard,
  IconReceipt,
  IconSparkles,
  IconUsers,
} from "@tabler/icons-react";
import { PermissionDTO } from "@repo/models";
import type { NavigationItem } from "@/@types/navigation";

/** Navigation principale ; la visibilité suit les permissions de l'API. */
export const navigationConfig: NavigationItem[] = [
  {
    key: "dashboard",
    path: "/dashboard",
    translateKey: "nav.dashboard",
    icon: IconLayoutDashboard,
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "expenses",
    path: "/expenses",
    translateKey: "nav.expenses",
    icon: IconReceipt,
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
  {
    key: "revolut",
    path: "/revolut",
    translateKey: "nav.revolut",
    icon: IconCreditCard,
    permissions: [PermissionDTO.EXPENSE_VIEW],
  },
];

export const adminNavigationConfig: NavigationItem[] = [
  {
    key: "adminAccounts",
    path: "/admin/accounts",
    translateKey: "nav.admin.accounts",
    icon: IconBuildingBank,
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminCategories",
    path: "/admin/categories",
    translateKey: "nav.admin.categories",
    icon: IconCategory,
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminAi",
    path: "/admin/ai",
    translateKey: "nav.admin.ai",
    icon: IconSparkles,
    permissions: [PermissionDTO.SETTINGS_MANAGE],
  },
  {
    key: "adminUsers",
    path: "/admin/users",
    translateKey: "nav.admin.users",
    icon: IconUsers,
    permissions: [PermissionDTO.USER_MANAGE],
  },
];
