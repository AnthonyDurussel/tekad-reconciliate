import type {
  BexioExpenseDetailDTO,
  BexioExpenseDTO,
  BexioExpenseQueryDTO,
} from "@repo/models";
import appConfig from "@/configs/app.config";
import { baseApi, cleanParams } from "./baseApi";

/** URL d'un fichier joint à la dépense dans bexio (aperçu PDF ou image). */
export const bexioExpenseFileUrl = (id: string, uuid: string) =>
  `${appConfig.apiPrefix}/bexio-expenses/${encodeURIComponent(id)}/files/${encodeURIComponent(uuid)}`;

/**
 * Les dépenses de bexio (« Ausgaben »), lues en direct par l'API (409 sans
 * bexio). Les rattacher à une dépense de l'application passe par
 * `expensesApi` (`PUT expenses/{id}/bexio`, `POST expenses/from-bexio`).
 */
export const bexioExpensesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBexioExpenses: build.query<
      BexioExpenseDTO[],
      BexioExpenseQueryDTO | void
    >({
      query: (params) => ({
        url: "bexio-expenses",
        params: cleanParams(params ?? {}),
      }),
      providesTags: ["BexioExpense"],
    }),
    /** La dépense et ses fichiers joints dans bexio. */
    getBexioExpense: build.query<BexioExpenseDetailDTO, string>({
      query: (id) => `bexio-expenses/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: "BexioExpense", id }],
    }),
  }),
});

export const { useGetBexioExpensesQuery, useGetBexioExpenseQuery } =
  bexioExpensesApi;
