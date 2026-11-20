import type {
  AiConnectionDTO,
  AiConnectionTestDTO,
  AiModelDTO,
  AiSettingsDTO,
  UpdateAiSettingsDTO,
} from "@repo/models";
import { baseApi } from "./baseApi";

/** Réglages de l'IA (OpenRouter, Mistral OCR) — administrateur. */
export const aiSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAiSettings: build.query<AiSettingsDTO, void>({
      query: () => "ai/settings",
      providesTags: ["AiSettings"],
    }),
    updateAiSettings: build.mutation<AiSettingsDTO, UpdateAiSettingsDTO>({
      query: (body) => ({ url: "ai/settings", method: "PUT", body }),
      invalidatesTags: ["AiSettings", "Sync"],
    }),
    resetAiSettings: build.mutation<AiSettingsDTO, void>({
      query: () => ({ url: "ai/settings", method: "DELETE" }),
      invalidatesTags: ["AiSettings", "Sync"],
    }),
    listAiModels: build.mutation<AiModelDTO[], AiConnectionDTO>({
      query: (body) => ({ url: "ai/settings/models", method: "POST", body }),
    }),
    testAiConnection: build.mutation<AiConnectionTestDTO, AiConnectionDTO>({
      query: (body) => ({ url: "ai/settings/test", method: "POST", body }),
    }),
  }),
});

export const {
  useGetAiSettingsQuery,
  useUpdateAiSettingsMutation,
  useResetAiSettingsMutation,
  useListAiModelsMutation,
  useTestAiConnectionMutation,
} = aiSettingsApi;
