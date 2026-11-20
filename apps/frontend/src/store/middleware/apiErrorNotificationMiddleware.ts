import { isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { notifications } from "@mantine/notifications";
import i18n from "i18next";
import { getErrorMessage } from "@/utils/apiError";

type RejectedMeta = {
  arg?: { type?: "query" | "mutation"; endpointName?: string };
};

/**
 * Requêtes dont l'échec attendu est géré par l'écran (bexio non connecté :
 * 409, les listes retombent sur la saisie libre) : pas de notification.
 */
const SILENT_ENDPOINTS = new Set(["getBexioAccounts", "getBexioTaxes"]);

/**
 * Notifie les **requêtes** en échec. Une mutation est toujours attendue par un
 * `unwrap()` dans un `try/catch` : le composant affiche l'erreur dans son
 * contexte, la notifier ici la ferait apparaître deux fois.
 */
export const apiErrorNotificationMiddleware: Middleware =
  () => (next) => (action) => {
    if (isRejectedWithValue(action)) {
      const meta = (action.meta ?? {}) as RejectedMeta;
      const error = action.payload as FetchBaseQueryError;
      if (
        meta.arg?.type !== "mutation" &&
        error.status !== 401 &&
        !SILENT_ENDPOINTS.has(meta.arg?.endpointName ?? "")
      ) {
        notifications.show({
          title: i18n.t("common.apiErrors.title"),
          message: getErrorMessage(error),
          color: "red",
        });
      }
    }
    return next(action);
  };
