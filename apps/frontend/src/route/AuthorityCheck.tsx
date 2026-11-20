import type { PropsWithChildren } from "react";
import type { PermissionDTO } from "@repo/models";
import usePermissions from "@/hooks/usePermissions";

type Props = PropsWithChildren<{ permissions?: PermissionDTO[] }>;

/** Affiche ses enfants si le compte a au moins une des permissions. */
export default function AuthorityCheck({ permissions = [], children }: Props) {
  const { canAny } = usePermissions();
  return canAny(permissions) ? <>{children}</> : null;
}
