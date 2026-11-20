import type { PermissionDTO } from "@repo/models";
import type { RouteAccess } from "@/shared/infrastructure/http/registerRoute.js";
import type { User } from "@/user/domain/User.js";

/**
 * Droits du compte de la requête, relus en base à chaque requête (jamais le
 * jeton) : un changement de rôle prend effet immédiatement.
 */
export interface IAuthorizationService {
  /** Le compte de la requête ; créé au premier passage (voir `AuthorizationService`). */
  currentUser(): Promise<User>;
  /** Contrôle l'accès déclaré d'une route (403 sinon). */
  authorize(access: RouteAccess): Promise<User>;
  require(permission: PermissionDTO): Promise<User>;
  requireAny(permissions: PermissionDTO[]): Promise<User>;
  can(permission: PermissionDTO): Promise<boolean>;
}
