import type { DashboardDTO } from "@repo/models";
import { baseApi, cleanParams } from "./baseApi";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<DashboardDTO, { from?: string; to?: string }>({
      query: (params) => ({ url: "dashboard", params: cleanParams(params) }),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
