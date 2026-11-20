import type { BexioAccountDTO, BexioTaxDTO } from "@repo/models";
import { baseApi } from "./baseApi";

/**
 * Plan comptable et codes TVA lus dans bexio. Sans `BEXIO_API_TOKEN`, l'API
 * répond 409 : les écrans reviennent alors à la saisie libre
 * (`isBexioNotConfigured`).
 */
export const bexioApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBexioAccounts: build.query<BexioAccountDTO[], void>({
      query: () => "bexio/accounts",
      providesTags: ["Bexio"],
    }),
    getBexioTaxes: build.query<BexioTaxDTO[], void>({
      query: () => "bexio/taxes",
      providesTags: ["Bexio"],
    }),
  }),
});

export const { useGetBexioAccountsQuery, useGetBexioTaxesQuery } = bexioApi;

/** bexio n'est pas configuré (409). */
export function isBexioNotConfigured(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 409
  );
}
