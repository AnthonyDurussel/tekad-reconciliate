import { useCallback } from "react";
import { APPLICATION_ACCESS_ROLE, type UserToken } from "@repo/models";
import { persistor, setUser, useAppDispatch, useAppSelector } from "@/store";
import appConfig from "@/configs/app.config";
import { signOutUrl } from "@/utils/signOutUrl";

const EMPTY_USER = {
  name: "",
  roles: [] as string[],
  email: "",
  userId: undefined,
};

async function fetchPrincipal(): Promise<UserToken | null> {
  try {
    const response = await fetch("/.auth/me");
    if (!response.ok) return null;
    return (await response.json()) as UserToken;
  } catch {
    return null;
  }
}

/** Session Azure Static Web Apps (`/.auth/me`) et déconnexion. */
export default function useAuth() {
  const dispatch = useAppDispatch();
  const { userId, roles, email, name } = useAppSelector((s) => s.auth.user);

  const retrieveSSO = useCallback(async () => {
    const principal = (await fetchPrincipal())?.clientPrincipal;
    if (principal?.userId) {
      const nameClaim = principal.claims?.find((c) => c.typ === "name");
      dispatch(
        setUser({
          userId: principal.userId,
          email: principal.userDetails,
          name: nameClaim?.val ?? principal.userDetails,
          roles: principal.userRoles ?? [],
        }),
      );
      return true;
    }
    dispatch(setUser(EMPTY_USER));
    return false;
  }, [dispatch]);

  /**
   * Retour à la page de connexion, session Microsoft du compte fermée
   * (`signOutUrl`). En dev, le faux `/.auth` n'a pas d'Entra ID derrière.
   */
  const signOut = async () => {
    const loginPath = appConfig.unAuthenticatedEntryPath;
    const target = import.meta.env.DEV
      ? `${appConfig.logoutUrl}?post_logout_redirect_uri=${encodeURIComponent(loginPath)}`
      : signOutUrl(
          (await fetchPrincipal())?.clientPrincipal?.claims,
          window.location.origin,
          loginPath,
        );
    dispatch(setUser(EMPTY_USER));
    // L'utilisateur vidé doit être écrit avant de quitter la page : sinon la
    // page de connexion, au retour, le relirait et reconnecterait aussitôt.
    await persistor.flush();
    window.location.href = target;
  };

  return {
    authenticated: userId,
    email,
    name,
    hasApplicationAccess: roles.includes(APPLICATION_ACCESS_ROLE),
    retrieveSSO,
    signOut,
  };
}
