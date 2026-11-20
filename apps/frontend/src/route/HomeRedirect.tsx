import { Navigate } from "react-router-dom";
import { PermissionDTO } from "@repo/models";
import usePermissions from "@/hooks/usePermissions";
import appConfig from "@/configs/app.config";

/**
 * Page d'arrivée : le tableau de bord pour qui lit les pièces ; à défaut
 * (un compte sans rôle métier), la gestion des comptes ou des réglages.
 */
export default function HomeRedirect() {
  const { can } = usePermissions();
  const to = can(PermissionDTO.EXPENSE_VIEW)
    ? appConfig.authenticatedEntryPath
    : can(PermissionDTO.SETTINGS_MANAGE)
      ? "/admin/accounts"
      : can(PermissionDTO.USER_MANAGE)
        ? "/admin/users"
        : appConfig.authenticatedEntryPath;
  return <Navigate replace to={to} />;
}
