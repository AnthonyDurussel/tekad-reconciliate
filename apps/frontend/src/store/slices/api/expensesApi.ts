import type {
  ExpenseDTO,
  ExpenseQueryDTO,
  IgnoreDTO,
  MatchCandidateDTO,
  MatchExpenseDTO,
  UpdateExpenseDTO,
} from "@repo/models";
import appConfig from "@/configs/app.config";
import { baseApi, cleanParams } from "./baseApi";

/** Ce qu'une action sur une pièce peut changer ailleurs. */
const AFFECTED = [
  "Expense",
  "Candidates",
  "RevolutTransaction",
  "Dashboard",
] as const;

/** URL du fichier de la pièce (aperçu PDF ou image). */
export const expenseFileUrl = (id: string) =>
  `${appConfig.apiPrefix}/expenses/${id}/file`;

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
    getExpenseCandidates: build.query<MatchCandidateDTO[], string>({
      query: (id) => `expenses/${id}/candidates`,
      providesTags: (_r, _e, id) => [{ type: "Candidates", id }],
    }),
    updateExpense: build.mutation<
      ExpenseDTO,
      { id: string; body: UpdateExpenseDTO }
    >({
      query: ({ id, body }) => ({ url: `expenses/${id}`, method: "PUT", body }),
      invalidatesTags: [...AFFECTED],
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
      invalidatesTags: [...AFFECTED],
    }),
    unbookExpense: build.mutation<ExpenseDTO, string>({
      query: (id) => ({ url: `expenses/${id}/unbook`, method: "POST" }),
      invalidatesTags: [...AFFECTED],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useGetExpenseQuery,
  useGetExpenseCandidatesQuery,
  useUpdateExpenseMutation,
  useExtractExpenseMutation,
  useMatchExpenseMutation,
  useIgnoreExpenseMutation,
  useRestoreExpenseMutation,
  useBookExpenseMutation,
  useUnbookExpenseMutation,
} = expensesApi;
