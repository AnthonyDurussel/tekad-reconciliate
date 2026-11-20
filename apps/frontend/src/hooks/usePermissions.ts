import { useMemo } from "react";
import {
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
  type PermissionDTO,
} from "@repo/models";
import { useAppSelector } from "@/store";

/**
 * Permissions du compte connecté, résolues par l'API (`users/me`). Le masquage
 * est un confort d'affichage : l'API reste la frontière.
 */
export default function usePermissions() {
  const permissions = useAppSelector((s) => s.auth.user.permissions);

  return useMemo(
    () => ({
      permissions,
      loaded: permissions !== undefined,
      can: (permission: PermissionDTO) =>
        hasPermission(permissions, permission),
      canAny: (required: PermissionDTO[] = []) =>
        hasAnyPermission(permissions, required),
      canAll: (required: PermissionDTO[] = []) =>
        hasEveryPermission(permissions, required),
    }),
    [permissions],
  );
}

export { usePermissions };
