import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { PermissionDTO, rolePermissions, RoleDTO } from "@repo/models";
import { renderWithProviders, screen } from "@test-utils";
import AuthorityGuard from "./AuthorityGuard";
import HomeRedirect from "./HomeRedirect";

const stateFor = (role: RoleDTO) => ({
  auth: {
    user: {
      name: "",
      email: "",
      roles: [role, "USER"],
      permissions: rolePermissions(role),
    },
  },
});

const tree = (
  <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route
      path="/admin/accounts"
      element={
        <AuthorityGuard permissions={[PermissionDTO.SETTINGS_MANAGE]}>
          <div>Comptes et cartes</div>
        </AuthorityGuard>
      }
    />
    <Route path="/dashboard" element={<div>Tableau de bord</div>} />
    <Route path="/public/access-denied" element={<div>Accès refusé</div>} />
  </Routes>
);

describe("AuthorityGuard", () => {
  it("laisse passer un compte qui a la permission", () => {
    renderWithProviders(tree, {
      route: "/admin/accounts",
      preloadedState: stateFor(RoleDTO.ADMIN),
    });
    expect(screen.getByText("Comptes et cartes")).toBeInTheDocument();
  });

  it("renvoie un·e comptable vers « accès refusé » sur le paramétrage", () => {
    renderWithProviders(tree, {
      route: "/admin/accounts",
      preloadedState: stateFor(RoleDTO.ACCOUNTANT),
    });
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });

  it("arrivée : le tableau de bord pour chaque rôle", () => {
    for (const role of [RoleDTO.ADMIN, RoleDTO.ACCOUNTANT, RoleDTO.VIEWER]) {
      const { unmount } = renderWithProviders(tree, {
        route: "/",
        preloadedState: stateFor(role),
      });
      expect(screen.getByText("Tableau de bord")).toBeInTheDocument();
      unmount();
    }
  });
});
