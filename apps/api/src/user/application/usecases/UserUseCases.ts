import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import {
  RoleDTO,
  type CreateUserDTO,
  type EntraAccessDTO,
  type UpdateMyPreferencesDTO,
  type UpdateUserDTO,
  type UserInvitationDTO,
} from "@repo/models";
import {
  ConflictError,
  InvalidStateError,
  NotFoundError,
} from "@/shared/domain/errors.js";
import { User } from "@/user/domain/User.js";
import type { IUserRepository } from "@/user/application/repositories/IUserRepository.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";
import type { EntraAccessChecker } from "@/user/application/services/EntraAccessChecker.js";
import type { UserInvitationSender } from "@/user/application/services/UserInvitationSender.js";

@injectable()
export class UserUseCases {
  constructor(
    @inject(USER_TYPES.IUserRepository) private users: IUserRepository,
    @inject(USER_TYPES.EntraAccessChecker)
    private entraAccess: EntraAccessChecker,
    @inject(USER_TYPES.UserInvitationSender)
    private invitations: UserInvitationSender,
  ) {}

  list(): Promise<User[]> {
    return this.users.list();
  }

  async options(): Promise<User[]> {
    return (await this.users.list()).filter((u) => u.active);
  }

  async create(
    input: CreateUserDTO,
  ): Promise<{ user: User; entraAccess: EntraAccessDTO }> {
    const email = User.normalizeEmail(input.email);
    if (await this.users.findByEmail(email)) {
      throw new ConflictError(`un compte existe déjà pour ${email}`);
    }
    // Avant l'enregistrement : une adresse hors du tenant de l'application
    // y est invitée (sans e-mail Microsoft) pour pouvoir se connecter.
    const access = await this.entraAccess.check(email, input.name.trim());
    const user = User.create({
      id: randomUUID(),
      ...input,
      email,
      entraTenantId: access.tenant?.tenantId ?? null,
      entraGuest: access.outcome === "GUEST_INVITED",
    });
    await this.users.create(user);
    // Relu : le nom du profil de compétence vient de la base.
    return {
      user: (await this.users.findById(user.id)) ?? user,
      entraAccess: access,
    };
  }

  /** (Ré)envoie l'e-mail d'invitation d'un compte actif. */
  async sendInvitation(id: string): Promise<UserInvitationDTO> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    if (!user.active) {
      throw new InvalidStateError(
        "ce compte est désactivé : réactivez-le avant de l'inviter",
      );
    }
    return this.invitations.send(user);
  }

  /**
   * Met à jour un compte. Le dernier administrateur actif ne peut être ni
   * rétrogradé ni désactivé : personne ne pourrait plus gérer les comptes.
   */
  async update(
    id: string,
    input: UpdateUserDTO,
  ): Promise<{ user: User; entraAccess?: EntraAccessDTO }> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    const wasActiveAdmin = user.active && user.role === RoleDTO.ADMIN;
    const email =
      input.email !== undefined ? User.normalizeEmail(input.email) : undefined;
    const emailChanged = email !== undefined && email !== user.email;
    if (emailChanged) {
      const existing = await this.users.findByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new ConflictError(`un compte existe déjà pour ${email}`);
      }
    }
    user.update({ ...input, email });
    let access: EntraAccessDTO | undefined;
    if (emailChanged) {
      // Une autre adresse peut appartenir à un autre tenant : revérifiée
      // comme à la création, invitée si elle est externe.
      access = await this.entraAccess.check(email, user.name);
      user.bindEntraTenant(
        access.tenant?.tenantId ?? null,
        access.outcome === "GUEST_INVITED",
      );
    }
    const stillActiveAdmin = user.active && user.role === RoleDTO.ADMIN;
    if (wasActiveAdmin && !stillActiveAdmin) {
      if ((await this.users.countActiveAdmins()) <= 1) {
        throw new ConflictError(
          "le dernier administrateur actif doit le rester",
        );
      }
    }
    await this.users.update(user);
    return {
      user: (await this.users.findById(user.id)) ?? user,
      ...(access ? { entraAccess: access } : {}),
    };
  }

  /**
   * Supprime un compte qui n'a jamais servi. Un compte qui a lancé des
   * synchronisations ou comptabilisé des pièces se désactive (409). On ne
   * supprime ni son propre compte ni le dernier administrateur actif.
   */
  async delete(id: string, currentUserId: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    if (user.id === currentUserId) {
      throw new ConflictError(
        "vous ne pouvez pas supprimer votre propre compte",
      );
    }
    if (user.active && user.role === RoleDTO.ADMIN) {
      if ((await this.users.countActiveAdmins()) <= 1) {
        throw new ConflictError(
          "le dernier administrateur actif ne peut pas être supprimé",
        );
      }
    }
    const activity = await this.users.countActivity(id);
    if (activity > 0) {
      throw new ConflictError(
        "ce compte a lancé des synchronisations ou comptabilisé des pièces : désactivez-le plutôt",
      );
    }
    await this.users.delete(id);
  }

  /** Suivi : ce que chacun règle pour lui-même (e-mails). */
  async updatePreferences(
    user: User,
    input: UpdateMyPreferencesDTO,
  ): Promise<User> {
    user.update({ notificationsEnabled: input.notificationsEnabled });
    await this.users.update(user);
    return user;
  }

  /**
   * Rôles exposés à Azure Static Web Apps (`rolesSource`). Un compte dont le
   * tenant a été vérifié n'est ouvert que par un jeton de ce tenant : un
   * autre tenant autorisé pourrait présenter la même adresse.
   */
  async rolesFor(
    email: string | undefined,
    tenantId?: string,
  ): Promise<string[]> {
    if (!email) return [];
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) {
      // Compte encore inconnu : il sera créé en lecture seule à sa
      // première requête.
      return ["USER"];
    }
    if (!user.acceptsTenant(tenantId)) return [];
    return user.active ? [user.role, "USER"] : [];
  }
}
