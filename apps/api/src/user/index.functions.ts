import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  publicRoute,
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { UserController } from "@/user/infrastructure/UserController.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";

const controller = (c: Container) =>
  c.get<UserController>(USER_TYPES.UserController);

export function registerUserRoutes(app: HttpRouteRegistrar) {
  route(app, {
    name: "getCurrentUser",
    methods: ["GET"],
    path: "users/me",
    access: "AUTHENTICATED",
    // Transactionnel : le premier passage crée le compte.
    tx: true,
    handler: (c) => controller(c).me(),
  });

  // ----- Suivi : préférences de notification -----
  route(app, {
    name: "updateMyPreferences",
    methods: ["PUT"],
    path: "users/me/preferences",
    access: "AUTHENTICATED",
    tx: true,
    handler: (c, r) => controller(c).updatePreferences(r),
  });

  route(app, {
    name: "listUserOptions",
    methods: ["GET"],
    path: "users/options",
    access: "AUTHENTICATED",
    tx: false,
    handler: (c) => controller(c).options(),
  });

  route(app, {
    name: "listUsers",
    methods: ["GET"],
    path: "users",
    access: PermissionDTO.USER_MANAGE,
    tx: false,
    handler: (c) => controller(c).list(),
  });

  route(app, {
    name: "createUser",
    methods: ["POST"],
    path: "users",
    access: PermissionDTO.USER_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).create(r),
  });

  // Avant `users/{id}` : « entra-access » n'est pas un identifiant.
  route(app, {
    name: "getEntraAccess",
    methods: ["GET"],
    path: "users/entra-access",
    access: PermissionDTO.USER_MANAGE,
    tx: false,
    handler: (c) => controller(c).entraAccess(),
  });

  route(app, {
    name: "sendUserInvitation",
    methods: ["POST"],
    path: "users/{id}/invitation",
    access: PermissionDTO.USER_MANAGE,
    tx: false,
    handler: (c, r) => controller(c).sendInvitation(r),
  });

  route(app, {
    name: "updateUser",
    methods: ["PUT"],
    path: "users/{id}",
    access: PermissionDTO.USER_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).update(r),
  });
  route(app, {
    name: "deleteUser",
    methods: ["DELETE"],
    path: "users/{id}",
    access: PermissionDTO.USER_MANAGE,
    tx: true,
    handler: (c, r) => controller(c).delete(r),
  });

  // Extracteur de rôles d'Azure Static Web Apps : appelé avant la session.
  publicRoute(app, {
    name: "rolesExtractor",
    methods: ["POST"],
    path: "roles",
    tx: false,
    handler: (c, r) => controller(c).extractRoles(r),
  });
}
