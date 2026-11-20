import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import type { PermissionDTO } from "@repo/models";
import usePermissions from "@/hooks/usePermissions";

type Props = PropsWithChildren<{ permissions?: PermissionDTO[] }>;

/** Barrière de route : « accès refusé » sans au moins une des permissions. */
export default function AuthorityGuard({ permissions = [], children }: Props) {
  const { canAny } = usePermissions();
  return canAny(permissions) ? (
    <>{children}</>
  ) : (
    <Navigate to="/public/access-denied" replace />
  );
}
