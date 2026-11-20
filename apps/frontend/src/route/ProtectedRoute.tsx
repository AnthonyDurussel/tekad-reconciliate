import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import appConfig from "@/configs/app.config";
import { REDIRECT_URL_KEY } from "@/constants/app.constant";
import useAuth from "@/hooks/useAuth";
import { usePermissionsSync } from "@/hooks/usePermissionsSync";
import LoadingScreen from "@/components/loading/LoadingScreen";

/**
 * Pages authentifiées : relit la session Azure si le store est vide, puis
 * charge les permissions (`users/me`) avant de rendre la page.
 */
export default function ProtectedRoute() {
  const { authenticated, hasApplicationAccess, retrieveSSO } = useAuth();
  const location = useLocation();
  const loadingPermissions = usePermissionsSync(
    !!authenticated && hasApplicationAccess,
  );
  const [noSession, setNoSession] = useState(false);

  // La session est relue à chaque ouverture, même avec un utilisateur
  // mémorisé dans le navigateur : sans session Azure, retour à la connexion.
  useEffect(() => {
    let cancelled = false;
    retrieveSSO().then((found) => {
      if (!cancelled && !found) setNoSession(true);
    });
    return () => {
      cancelled = true;
    };
  }, [retrieveSSO]);

  if (!authenticated && !noSession) return <LoadingScreen />;

  if (!authenticated || noSession) {
    const target = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <Navigate
        replace
        to={`${appConfig.unAuthenticatedEntryPath}?${REDIRECT_URL_KEY}=${target}`}
      />
    );
  }

  if (!hasApplicationAccess)
    return <Navigate replace to="/public/access-denied" />;

  if (loadingPermissions) return <LoadingScreen />;

  return <Outlet />;
}
