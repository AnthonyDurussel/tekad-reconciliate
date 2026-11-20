import i18n from "i18next";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

type ApiErrorBody = { error?: string; message?: string };

/** Message lisible d'une erreur RTK Query (corps `{ error, message }` de l'API). */
export function getErrorMessage(error: unknown): string {
  const e = error as FetchBaseQueryError | SerializedError | undefined;
  if (!e) return i18n.t("common.apiErrors.unexpected");
  if ("status" in e) {
    if (e.status === "FETCH_ERROR") return i18n.t("common.apiErrors.network");
    const body = e.data as ApiErrorBody | undefined;
    if (body?.message) return body.message.replace(/^[A-Za-z ]+: /, "");
    if (e.status === 403) return i18n.t("common.apiErrors.forbidden");
    if (e.status === 404) return i18n.t("common.apiErrors.notFound");
    if (typeof e.status === "number" && e.status >= 500)
      return i18n.t("common.apiErrors.server");
    return body?.error ?? i18n.t("common.apiErrors.unexpected");
  }
  return e.message ?? i18n.t("common.apiErrors.unexpected");
}

/** 409 : pour une lecture bexio, bexio n'est pas configuré. */
export function isConflict(error: unknown): boolean {
  const e = error as FetchBaseQueryError | SerializedError | undefined;
  return !!e && "status" in e && e.status === 409;
}
