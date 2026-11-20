import type {
  BexioExpenseDTO,
  BexioExpenseQueryDTO,
  LinkBexioExpenseDTO,
} from "@repo/models";
import { baseApi, cleanParams } from "./baseApi";

/** Lier ou délier une pièce change la dépense, la pièce et les chiffres. */
const AFFECTED = ["BexioExpense", "Expense", "Dashboard"] as const;

/**
 * Les dépenses de bexio (« Ausgaben »), synchronisées par
 * `POST sync/bexio-expenses` : pièce liée et rapprochement.
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
    /** Joint le fichier de la pièce à la dépense dans bexio, et les lie. */
    linkBexioExpense: build.mutation<
      BexioExpenseDTO,
      { id: string; body: LinkBexioExpenseDTO }
    >({
      query: ({ id, body }) => ({
        url: `bexio-expenses/${id}/link`,
        method: "POST",
        body,
      }),
      invalidatesTags: [...AFFECTED],
    }),
    /** Lien local seulement : le fichier reste joint dans bexio. */
    unlinkBexioExpense: build.mutation<BexioExpenseDTO, string>({
      query: (id) => ({
        url: `bexio-expenses/${id}/unlink`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: [...AFFECTED],
    }),
  }),
});

export const {
  useGetBexioExpensesQuery,
  useLinkBexioExpenseMutation,
  useUnlinkBexioExpenseMutation,
} = bexioExpensesApi;
