import type {
  BexioExpenseDTO,
  CreateExpenseFromBexioDTO,
  CreateExpenseFromTransactionDTO,
  ExpenseDTO,
  ExpenseQueryDTO,
  IgnoreDTO,
  LinkExpenseBexioDTO,
  LinkReceiptDTO,
  MatchCandidateDTO,
  MatchExpenseDTO,
  ReceiptDTO,
  UpdateExpenseDTO,
} from "@repo/models";
import appConfig from "@/configs/app.config";
import { baseApi, cleanParams } from "./baseApi";

/** Ce qu'une action sur une dépense peut changer ailleurs. */
const AFFECTED = [
  "Expense",
  "Candidates",
  "ReceiptCandidates",
  "BexioCandidates",
  "RevolutTransaction",
  "Dashboard",
] as const;

/**
 * Ce qui touche aussi bexio (dépense créée, fichier joint, lien) : la liste
 * des dépenses bexio montre la dépense rattachée.
 */
const AFFECTED_WITH_BEXIO = [...AFFECTED, "BexioExpense"] as const;

/** URL du fichier de la pièce d'une dépense (aperçu PDF ou image). */
export const expenseFileUrl = (id: string) =>
  `${appConfig.apiPrefix}/expenses/${id}/file`;

/** URL du fichier d'une pièce (candidate au rattachement). */
export const receiptFileUrl = (id: string) =>
  `${appConfig.apiPrefix}/receipts/${id}/file`;

/** URL de l'export Excel, avec les filtres de la liste. */
export const expensesExportUrl = (query: ExpenseQueryDTO) => {
  const params = new URLSearchParams(cleanParams(query)).toString();
  return `${appConfig.apiPrefix}/expenses/export${params ? `?${params}` : ""}`;
};

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query<ExpenseDTO[], ExpenseQueryDTO | void>({
      query: (params) => ({
        url: "expenses",
        params: cleanParams(params ?? {}),
      }),
      providesTags: ["Expense"],
    }),
    getExpense: build.query<ExpenseDTO, string>({
      query: (id) => `expenses/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Expense", id }],
    }),
    /** Transactions du relevé candidates au rapprochement. */
    getExpenseCandidates: build.query<MatchCandidateDTO[], string>({
      query: (id) => `expenses/${id}/candidates`,
      providesTags: (_r, _e, id) => [{ type: "Candidates", id }],
    }),
    /** Pièces qu'on peut rattacher (orphelines, ou seules sur leur dépense). */
    getExpenseReceiptCandidates: build.query<ReceiptDTO[], string>({
      query: (id) => `expenses/${id}/receipt-candidates`,
      providesTags: (_r, _e, id) => [{ type: "ReceiptCandidates", id }],
    }),
    /** Dépenses bexio non rattachées autour de la date (± 10 jours). */
    getExpenseBexioCandidates: build.query<BexioExpenseDTO[], string>({
      query: (id) => `expenses/${id}/bexio-candidates`,
      providesTags: (_r, _e, id) => [{ type: "BexioCandidates", id }],
    }),
    /** Une dépense pour une sortie du relevé sans pièce. */
    createExpenseFromTransaction: build.mutation<
      ExpenseDTO,
      CreateExpenseFromTransactionDTO
    >({
      query: (body) => ({
        url: "expenses/from-transaction",
        method: "POST",
        body,
      }),
      invalidatesTags: [...AFFECTED],
    }),
    /** La dépense de l'application pour une dépense bexio. */
    createExpenseFromBexio: build.mutation<
      ExpenseDTO,
      CreateExpenseFromBexioDTO
    >({
      query: (body) => ({ url: "expenses/from-bexio", method: "POST", body }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    updateExpense: build.mutation<
      ExpenseDTO,
      { id: string; body: UpdateExpenseDTO }
    >({
      query: ({ id, body }) => ({ url: `expenses/${id}`, method: "PUT", body }),
      invalidatesTags: [...AFFECTED],
    }),
    /** Rattache une pièce ; le fichier est joint dans bexio si besoin. */
    linkExpenseReceipt: build.mutation<
      ExpenseDTO,
      { id: string; body: LinkReceiptDTO }
    >({
      query: ({ id, body }) => ({
        url: `expenses/${id}/receipt`,
        method: "PUT",
        body,
      }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    /** Détache la pièce : elle retrouve sa propre dépense. */
    unlinkExpenseReceipt: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/receipt`, method: "DELETE" }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    /** Rattache une dépense bexio (le fichier de la pièce y est joint). */
    linkExpenseBexio: build.mutation<
      ExpenseDTO,
      { id: string; body: LinkExpenseBexioDTO }
    >({
      query: ({ id, body }) => ({
        url: `expenses/${id}/bexio`,
        method: "PUT",
        body,
      }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    /** Détache la dépense bexio, ici seulement. */
    unlinkExpenseBexio: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/bexio`, method: "DELETE" }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    extractExpense: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/extract`, method: "POST" }),
      invalidatesTags: [...AFFECTED],
    }),
    matchExpense: build.mutation<
      ExpenseDTO,
      { id: string; body: MatchExpenseDTO }
    >({
      query: ({ id, body }) => ({
        url: `expenses/${id}/match`,
        method: "POST",
        body,
      }),
      invalidatesTags: [...AFFECTED],
    }),
    ignoreExpense: build.mutation<ExpenseDTO, { id: string; body?: IgnoreDTO }>(
      {
        query: ({ id, body }) => ({
          url: `expenses/${id}/ignore`,
          method: "POST",
          body: body ?? {},
        }),
        invalidatesTags: [...AFFECTED],
      },
    ),
    restoreExpense: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/restore`, method: "POST" }),
      invalidatesTags: [...AFFECTED],
    }),
    bookExpense: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/book`, method: "POST" }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
    unbookExpense: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/unbook`, method: "POST" }),
      invalidatesTags: [...AFFECTED_WITH_BEXIO],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useGetExpenseQuery,
  useGetExpenseCandidatesQuery,
  useGetExpenseReceiptCandidatesQuery,
  useGetExpenseBexioCandidatesQuery,
  useCreateExpenseFromTransactionMutation,
  useCreateExpenseFromBexioMutation,
  useUpdateExpenseMutation,
  useLinkExpenseReceiptMutation,
  useUnlinkExpenseReceiptMutation,
  useLinkExpenseBexioMutation,
  useUnlinkExpenseBexioMutation,
  useExtractExpenseMutation,
  useMatchExpenseMutation,
  useIgnoreExpenseMutation,
  useRestoreExpenseMutation,
  useBookExpenseMutation,
  useUnbookExpenseMutation,
} = expensesApi;
