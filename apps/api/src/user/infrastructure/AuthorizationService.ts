import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import { PermissionDTO, RoleDTO, hasPermission } from "@repo/models";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "@/shared/domain/errors.js";
import { currentPrincipal } from "@/shared/infrastructure/withContext.js";
import type { RouteAccess } from "@/shared/infrastructure/http/registerRoute.js";
import { User } from "@/user/domain/User.js";
import type { IUserRepository } from "@/user/application/repositories/IUserRepository.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";

/** Le tenant Entra ID du jeton, sous son nom court ou long. */
function tenantOf(
  claims: { typ: string; val: string }[] | undefined,
): string | undefined {
  return claims
    ?.find((c) => c.typ === "tid" || c.typ.endsWith("/claims/tenantid"))
    ?.val?.trim();
}

/** `last_seen_at` n'est réécrit qu'au-delà de ce délai, pas à chaque requête. */
const SEEN_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Résout le compte de la requête depuis le principal Azure (`userDetails` =
 * e-mail) et contrôle ses permissions. Lié une fois par conteneur de requête :
 * le compte est lu une seule fois par requête.
 *
 * Premier passage d'un compte inconnu :
 * - aucun administrateur actif → il est créé **ADMIN** (amorçage de
 *   l'installation, même quand le seed a déjà créé des comptes de démo) ;
 * - sinon → **VIEWER** (lecture seule) : le tenant Azure filtre déjà qui
 *   entre, et un administrateur lui donne ensuite son rôle.
 */
@injectable()
export class AuthorizationService implements IAuthorizationService {
  private resolved: Promise<User> | null = null;

  constructor(
    @inject(USER_TYPES.IUserRepository) private users: IUserRepository,
  ) {}

  currentUser(): Promise<User> {
    if (!this.resolved) {
      this.resolved = this.resolve().catch((error) => {
        this.resolved = null;
        throw error;
      });
    }
    return this.resolved;
  }

  private async resolve(): Promise<User> {
    const principal = currentPrincipal();
    if (!principal?.userDetails) {
      throw new UnauthorizedError("aucun principal");
    }
    const email = User.normalizeEmail(principal.userDetails);
    let user = await this.users.findByEmail(email);
    if (!user) {
      user = await this.provision(email, principal.claims);
    }
    if (!user.active) {
      throw new ForbiddenError("compte désactivé");
    }
    // Compte au tenant vérifié : un jeton d'un autre tenant qui porterait la
    // même adresse est refusé (contrôlé quand l'hébergeur transmet le tenant).
    const tenantId = tenantOf(principal.claims);
    if (tenantId && !user.acceptsTenant(tenantId)) {
      throw new ForbiddenError("tenant Entra ID non reconnu pour ce compte");
    }
    const now = new Date();
    if (
      !user.lastSeenAt ||
      now.getTime() - user.lastSeenAt.getTime() > SEEN_THROTTLE_MS
    ) {
      user.touch(now);
      await this.users.markSeen(user.id, now);
    }
    return user;
  }

  private async provision(
    email: string,
    claims: { typ: string; val: string }[] | undefined,
  ): Promise<User> {
    const role =
      (await this.users.countActiveAdmins()) === 0
        ? RoleDTO.ADMIN
        : RoleDTO.VIEWER;
    const claimName = claims?.find(
      (c) => c.typ === "name" || c.typ.endsWith("/claims/name"),
    )?.val;
    // Le tenant du jeton, quand l'hébergeur le transmet : seul un jeton de
    // ce tenant ouvrira ensuite le compte.
    const tenantId = tenantOf(claims);
    const user = User.create({
      id: randomUUID(),
      email,
      name: claimName?.trim() || User.nameFromEmail(email) || email,
      role,
      entraTenantId: tenantId?.trim() || null,
    });
    try {
      await this.users.create(user);
      return user;
    } catch (error) {
      // Deux premières requêtes simultanées : l'autre a créé le compte.
      if (error instanceof ConflictError) {
        const existing = await this.users.findByEmail(email);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async authorize(access: RouteAccess): Promise<User> {
    if (access === "AUTHENTICATED") return this.currentUser();
    if (Array.isArray(access)) return this.requireAny(access);
    return this.require(access);
  }

  async require(permission: PermissionDTO): Promise<User> {
    const user = await this.currentUser();
    if (!hasPermission(user.permissions, permission)) {
      throw new ForbiddenError(`permission ${permission} requise`);
    }
    return user;
  }

  async requireAny(permissions: PermissionDTO[]): Promise<User> {
    const user = await this.currentUser();
    if (
      permissions.length > 0 &&
      !permissions.some((p) => hasPermission(user.permissions, p))
    ) {
      throw new ForbiddenError(
        `l'une des permissions ${permissions.join(", ")} est requise`,
      );
    }
    return user;
  }

  async can(permission: PermissionDTO): Promise<boolean> {
    const user = await this.currentUser();
    return hasPermission(user.permissions, permission);
  }
}
