import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { PermissionDTO, rolePermissions, RoleDTO } from "@repo/models";
import { staticRootReducer } from "@/store/rootReducer";
import usePermissions from "./usePermissions";

function setup(permissions?: PermissionDTO[]) {
  const store = configureStore({
    reducer: staticRootReducer,
    preloadedState: {
      auth: { user: { name: "", email: "", roles: [], permissions } },
    } as any,
    middleware: (gdm) => gdm({ serializableCheck: false }),
  });
  return renderHook(() => usePermissions(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  }).result.current;
}

describe("usePermissions", () => {
  it("lit les permissions résolues par l'API", () => {
    const p = setup(rolePermissions(RoleDTO.ACCOUNTANT));
    expect(p.loaded).toBe(true);
    expect(p.can(PermissionDTO.EXPENSE_BOOK)).toBe(true);
    expect(p.can(PermissionDTO.SETTINGS_MANAGE)).toBe(false);
    expect(
      p.canAny([PermissionDTO.SETTINGS_MANAGE, PermissionDTO.SYNC_RUN]),
    ).toBe(true);
    expect(
      p.canAll([PermissionDTO.SETTINGS_MANAGE, PermissionDTO.SYNC_RUN]),
    ).toBe(false);
  });

  it("une liste vide n'exige rien ; des permissions jamais chargées n'ouvrent rien", () => {
    const p = setup(undefined);
    expect(p.loaded).toBe(false);
    expect(p.canAny([])).toBe(true);
    expect(p.can(PermissionDTO.EXPENSE_VIEW)).toBe(false);
  });
});
