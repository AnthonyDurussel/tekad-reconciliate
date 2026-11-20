import type {
  IgnoreDTO,
  RevolutTransactionDTO,
  RevolutTransactionQueryDTO,
} from "@repo/models";
import { baseApi, cleanParams } from "./baseApi";

export const revolutApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRevolutTransactions: build.query<
      RevolutTransactionDTO[],
      RevolutTransactionQueryDTO | void
    >({
      query: (params) => ({
        url: "revolut/transactions",
        params: cleanParams(params ?? {}),
      }),
      providesTags: ["RevolutTransaction"],
    }),
    ignoreRevolutTransaction: build.mutation<
      RevolutTransactionDTO,
      { id: string; body?: IgnoreDTO }
    >({
      query: ({ id, body }) => ({
        url: `revolut/transactions/${id}/ignore`,
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: ["RevolutTransaction", "Candidates", "Dashboard"],
    }),
    restoreRevolutTransaction: build.mutation<RevolutTransactionDTO, string>({
      query: (id) => ({
        url: `revolut/transactions/${id}/restore`,
        method: "POST",
      }),
      invalidatesTags: ["RevolutTransaction", "Candidates", "Dashboard"],
    }),
  }),
});

export const {
  useGetRevolutTransactionsQuery,
  useIgnoreRevolutTransactionMutation,
  useRestoreRevolutTransactionMutation,
} = revolutApi;
