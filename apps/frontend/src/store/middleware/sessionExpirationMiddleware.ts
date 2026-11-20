import { isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { setUser } from "../slices/auth";

/**
 * Session expirée (401) : on vide l'utilisateur, `ProtectedRoute` relit la
 * session Azure et renvoie vers la connexion si elle n'existe plus.
 */
export const sessionExpirationMiddleware: Middleware =
  ({ dispatch }) =>
  (next) =>
  (action) => {
    if (isRejectedWithValue(action)) {
      const error = action.payload as FetchBaseQueryError;
      if (error.status === 401) {
        dispatch(
          setUser({ name: "", email: "", roles: [], userId: undefined }),
        );
      }
    }
    return next(action);
  };
