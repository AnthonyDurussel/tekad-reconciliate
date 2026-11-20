import type {
  CreateExpenseCategoryDTO,
  CreatePaymentAccountDTO,
  ExpenseCategoryDTO,
  PaymentAccountDTO,
  UpdateExpenseCategoryDTO,
  UpdatePaymentAccountDTO,
} from "@repo/models";
import { baseApi } from "./baseApi";

/**
 * Paramétrage : comptes de paiement (et leurs cartes), types de dépense.
 * Changer l'un change le classement et l'imputation proposée des pièces :
 * les pièces et le tableau de bord se relisent.
 */
const AFFECTED = ["Expense", "Candidates", "Dashboard"] as const;

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPaymentAccounts: build.query<PaymentAccountDTO[], void>({
      query: () => "payment-accounts",
      providesTags: ["PaymentAccount"],
    }),
    createPaymentAccount: build.mutation<
      PaymentAccountDTO,
      CreatePaymentAccountDTO
    >({
      query: (body) => ({ url: "payment-accounts", method: "POST", body }),
      invalidatesTags: ["PaymentAccount", ...AFFECTED],
    }),
    updatePaymentAccount: build.mutation<
      PaymentAccountDTO,
      { id: string; body: UpdatePaymentAccountDTO }
    >({
      query: ({ id, body }) => ({
        url: `payment-accounts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["PaymentAccount", ...AFFECTED],
    }),
    deletePaymentAccount: build.mutation<void, string>({
      query: (id) => ({ url: `payment-accounts/${id}`, method: "DELETE" }),
      invalidatesTags: ["PaymentAccount"],
    }),
    getExpenseCategories: build.query<ExpenseCategoryDTO[], void>({
      query: () => "expense-categories",
      providesTags: ["ExpenseCategory"],
    }),
    createExpenseCategory: build.mutation<
      ExpenseCategoryDTO,
      CreateExpenseCategoryDTO
    >({
      query: (body) => ({ url: "expense-categories", method: "POST", body }),
      invalidatesTags: ["ExpenseCategory", ...AFFECTED],
    }),
    updateExpenseCategory: build.mutation<
      ExpenseCategoryDTO,
      { id: string; body: UpdateExpenseCategoryDTO }
    >({
      query: ({ id, body }) => ({
        url: `expense-categories/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["ExpenseCategory", ...AFFECTED],
    }),
    deleteExpenseCategory: build.mutation<void, string>({
      query: (id) => ({ url: `expense-categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["ExpenseCategory"],
    }),
  }),
});

export const {
  useGetPaymentAccountsQuery,
  useCreatePaymentAccountMutation,
  useUpdatePaymentAccountMutation,
  useDeletePaymentAccountMutation,
  useGetExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
} = settingsApi;
