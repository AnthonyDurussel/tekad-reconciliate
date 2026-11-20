import type {
  CreateUserDTO,
  CurrentUserDTO,
  EntraAccessSettingsDTO,
  UpdateMyPreferencesDTO,
  UpdateUserDTO,
  UserDTO,
  UserInvitationDTO,
  UserOptionDTO,
} from "@repo/models";
import { baseApi } from "./baseApi";

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<CurrentUserDTO, void>({
      query: () => "users/me",
      providesTags: ["Me"],
    }),
    getUserOptions: build.query<UserOptionDTO[], void>({
      query: () => "users/options",
      providesTags: ["User"],
    }),
    getUsers: build.query<UserDTO[], void>({
      query: () => "users",
      providesTags: ["User"],
    }),
    createUser: build.mutation<UserDTO, CreateUserDTO>({
      query: (body) => ({ url: "users", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    updateUser: build.mutation<UserDTO, { id: string; body: UpdateUserDTO }>({
      query: ({ id, body }) => ({ url: `users/${id}`, method: "PUT", body }),
      invalidatesTags: ["User", "Me"],
    }),
    // (Ré)envoi de l'e-mail d'invitation.
    deleteUser: build.mutation<void, string>({
      query: (id) => ({ url: `users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    sendUserInvitation: build.mutation<UserInvitationDTO, string>({
      query: (id) => ({ url: `users/${id}/invitation`, method: "POST" }),
    }),
    // Qui peut se connecter, d'après l'App Registration (lecture seule).
    getEntraAccess: build.query<EntraAccessSettingsDTO, void>({
      query: () => "users/entra-access",
    }),
    // Chacun règle ses e-mails.
    updateMyPreferences: build.mutation<CurrentUserDTO, UpdateMyPreferencesDTO>(
      {
        query: (body) => ({ url: "users/me/preferences", method: "PUT", body }),
        invalidatesTags: ["Me", "User"],
      },
    ),
    getBackendInfo: build.query<{ environment: string; version: string }, void>(
      {
        query: () => "config/backend",
        providesTags: ["BackendInfo"],
      },
    ),
  }),
});

export const {
  useGetMeQuery,
  useGetUserOptionsQuery,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useSendUserInvitationMutation,
  useGetEntraAccessQuery,
  useUpdateMyPreferencesMutation,
  useGetBackendInfoQuery,
} = usersApi;
