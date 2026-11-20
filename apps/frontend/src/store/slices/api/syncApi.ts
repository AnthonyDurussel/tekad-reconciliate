import type {
  RevolutSyncRequestDTO,
  SyncRunDTO,
  SyncStatusDTO,
} from "@repo/models";
import { baseApi } from "./baseApi";

/** Une synchronisation peut tout changer : pièces, transactions, chiffres. */
const AFFECTED = [
  "Sync",
  "Expense",
  "Candidates",
  "RevolutTransaction",
  "Dashboard",
] as const;

export type SyncTarget = "bexio-inbox" | "extract" | "revolut" | "match";

export const syncApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSyncStatus: build.query<SyncStatusDTO, void>({
      query: () => "sync/status",
      providesTags: ["Sync"],
    }),
    getSyncRuns: build.query<SyncRunDTO[], void>({
      query: () => "sync/runs",
      providesTags: ["Sync"],
    }),
    runSync: build.mutation<
      SyncRunDTO,
      { target: SyncTarget; body?: RevolutSyncRequestDTO }
    >({
      query: ({ target, body }) => ({
        url: `sync/${target}`,
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: [...AFFECTED],
    }),
    runSyncAll: build.mutation<SyncRunDTO[], void>({
      query: () => ({ url: "sync/all", method: "POST", body: {} }),
      invalidatesTags: [...AFFECTED],
    }),
  }),
});

export const {
  useGetSyncStatusQuery,
  useGetSyncRunsQuery,
  useRunSyncMutation,
  useRunSyncAllMutation,
} = syncApi;
