import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import appConfig from "@/configs/app.config";
import { REDIRECT_URL_KEY } from "@/constants/app.constant";

/**
 * Un seul `createApi` : chaque module injecte ses endpoints
 * (`injectEndpoints`), si bien qu'une mutation d'un module invalide les
 * lectures d'un autre (une pièce comptabilisée relit la liste, le tableau
 * de bord et les transactions Revolut).
 */
export const API_TAG_TYPES = [
  "Me",
  "User",
  "BackendInfo",
  "PaymentAccount",
  "ExpenseCategory",
  "Expense",
  "Candidates",
  "RevolutTransaction",
  "Dashboard",
  "Sync",
  "AiSettings",
] as const;

export type ApiTagType = (typeof API_TAG_TYPES)[number];

/**
 * Session expirée ou fermée : Static Web Apps répond 401 → 302 vers la page
 * de connexion (`responseOverrides` de `staticwebapp.config.json`). On ne suit
 * pas la redirection : une réponse `opaqueredirect` renvoie toute la page
 * vers **notre** page de connexion, qui ramène ensuite ici — jamais
 * directement vers Microsoft, qui reconnecterait sans rien demander.
 */
export const fetchWithoutRedirect: typeof fetch = async (input, init) => {
  const response = await fetch(
    new Request(input, { ...init, redirect: "manual" }),
  );
  if (response.type === "opaqueredirect") {
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(
      `${appConfig.unAuthenticatedEntryPath}?${REDIRECT_URL_KEY}=${encodeURIComponent(here)}`,
    );
  }
  return response;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: appConfig.apiPrefix,
    fetchFn: fetchWithoutRedirect,
  }),
  tagTypes: API_TAG_TYPES,
  endpoints: () => ({}),
});

/** Paramètres de requête sans les valeurs vides. */
export function cleanParams<T extends object>(
  params?: T,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      out[key] = String(value);
  }
  return out;
}
