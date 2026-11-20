import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { PermissionDTO } from "@repo/models";

export interface UserState {
  userId?: string;
  name: string;
  email: string;
  /** Rôles du jeton Azure : le code du rôle, plus le marqueur `USER`. */
  roles: string[];
  /**
   * Permissions résolues par l'API (`users/me`). `undefined` tant qu'elles
   * n'ont jamais été chargées (écran de chargement, jamais « accès refusé »).
   */
  permissions?: PermissionDTO[];
  /** Code du rôle enregistré en base. */
  role?: string;
}

const initialState: UserState = { name: "", email: "", roles: [] };

const userSlice = createSlice({
  name: "auth/user",
  initialState,
  reducers: {
    /** Identité SSO ; un autre compte efface les permissions connues. */
    setUser(
      state,
      action: PayloadAction<Omit<UserState, "permissions" | "role">>,
    ) {
      const sameAccount =
        !!action.payload.userId && action.payload.userId === state.userId;
      state.userId = action.payload.userId;
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.roles = action.payload.roles;
      if (!sameAccount) {
        state.permissions = undefined;
        state.role = undefined;
      }
    },
    setPermissions(
      state,
      action: PayloadAction<{
        permissions: PermissionDTO[];
        role: string;
        name?: string;
      }>,
    ) {
      state.permissions = action.payload.permissions;
      state.role = action.payload.role;
      if (action.payload.name) state.name = action.payload.name;
    },
  },
});

export const { setUser, setPermissions } = userSlice.actions;
export default userSlice.reducer;
