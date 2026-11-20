import type {
  BexioExpenseDetailDTO,
  BexioExpenseDTO,
  BexioExpenseQueryDTO,
  LinkBexioExpenseDTO,
  SetBexioExpenseAccountDTO,
} from "@repo/models";
import appConfig from "@/configs/app.config";
import { baseApi, cleanParams } from "./baseApi";

/**
 * URL d'un fichier de la dépense bexio (aperçu PDF ou image) : un fichier
 * joint dans bexio, ou celui de la pièce liée.
 */
export const bexioExpenseFileUrl = (id: string, uuid: string) =>
  `${appConfig.apiPrefix}/bexio-expenses/${encodeURIComponent(id)}/files/${encodeURIComponent(uuid)}`;

/**
 * Lier ou délier une pièce change la dépense (liste et détail : le type seul
 * invalide aussi les tags par id), la pièce et les chiffres.
 */
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
    /** La dépense et ses fichiers joints dans bexio. */
    getBexioExpense: build.query<BexioExpenseDetailDTO, string>({
      query: (id) => `bexio-expenses/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: "BexioExpense", id }],
    }),
    /**
     * Le compte payeur de la dépense (`null` : de nouveau déduit) ;
     * `applyToBankAccount` associe son compte bancaire bexio au compte de
     * paiement, que toutes ses dépenses suivent.
     */
    setBexioExpensePaymentAccount: build.mutation<
      BexioExpenseDTO,
      { id: string; body: SetBexioExpenseAccountDTO }
    >({
      query: ({ id, body }) => ({
        url: `bexio-expenses/${encodeURIComponent(id)}/payment-account`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["BexioExpense", "PaymentAccount", "Dashboard"],
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
  useGetBexioExpenseQuery,
  useSetBexioExpensePaymentAccountMutation,
  useLinkBexioExpenseMutation,
  useUnlinkBexioExpenseMutation,
} = bexioExpensesApi;
