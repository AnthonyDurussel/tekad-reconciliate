import { describe, expect, it } from "vitest";
import { PermissionDTO, RoleDTO } from "@repo/models";
import { AuthorizationService } from "@/user/infrastructure/AuthorizationService.js";
import { User } from "@/user/domain/User.js";
import type { IUserRepository } from "@/user/application/repositories/IUserRepository.js";
import { asyncLocalStorage } from "@/shared/infrastructure/withContext.js";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "@/shared/domain/errors.js";
import { UserUseCases } from "@/user/application/usecases/UserUseCases.js";
import type { EntraAccessChecker } from "@/user/application/services/EntraAccessChecker.js";
import type { UserInvitationSender } from "@/user/application/services/UserInvitationSender.js";

/**
 * Graph non configuré : rien n'est vérifié, sauf `refuse.ch` (refusé) et
 * `gmail.com` (invité dans le tenant de l'application).
 */
const entraAccess = {
  check: async (email: string) => {
    if (email.endsWith("@refuse.ch")) throw new Error("tenant non autorisé");
    if (email.endsWith("@partner.ch")) {
      return { outcome: "ALLOWED_TENANT", tenant: { tenantId: "T-PARTNER" } };
    }
    if (email.endsWith("@gmail.com")) {
      return { outcome: "GUEST_INVITED", tenant: { tenantId: "T-HOME" } };
    }
    return { outcome: "NOT_CONFIGURED" };
  },
} as unknown as EntraAccessChecker;

const sent: string[] = [];
const invitations = {
  send: async (user: User) => {
    sent.push(user.email);
    return { outcome: "SENT" };
  },
} as unknown as UserInvitationSender;

const useCasesOf = (repo: IUserRepository) =>
  new UserUseCases(repo, entraAccess, invitations);

class MemoryUsers implements IUserRepository {
  users = new Map<string, User>();
  async findById(id: string) {
    return [...this.users.values()].find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.users.get(email) ?? null;
  }
  async list() {
    return [...this.users.values()];
  }
  async count() {
    return this.users.size;
  }
  async countActiveAdmins() {
    return [...this.users.values()].filter(
      (u) => u.active && u.role === RoleDTO.ADMIN,
    ).length;
  }
  async create(user: User) {
    if (this.users.has(user.email)) throw new ConflictError("dup");
    this.users.set(user.email, user);
  }
  async update(user: User) {
    for (const [email, u] of this.users)
      if (u.id === user.id) this.users.delete(email);
    this.users.set(user.email, user);
  }
  async markSeen() {}
  activity = new Map<string, number>();
  async countActivity(id: string) {
    return this.activity.get(id) ?? 0;
  }
  async delete(id: string) {
    for (const [email, u] of this.users)
      if (u.id === id) this.users.delete(email);
  }
}

const as = <T>(email: string, fn: () => Promise<T>) =>
  asyncLocalStorage.run(
    {
      context: undefined as any,
      userPrincipal: {
        userId: email,
        userDetails: email,
        userRoles: [],
        identityProvider: "aad",
        claims: [],
      },
    },
    fn,
  );

describe("AuthorizationService", () => {
  it("premier compte ADMIN, les suivants VIEWER", async () => {
    const repo = new MemoryUsers();
    const first = await as("Chef.Exploitation@tekad.ch", () =>
      new AuthorizationService(repo).currentUser(),
    );
    expect(first.role).toBe(RoleDTO.ADMIN);
    expect(first.email).toBe("chef.exploitation@tekad.ch");
    expect(first.name).toBe("Chef Exploitation");

    const second = await as("jean.dupont@tekad.ch", () =>
      new AuthorizationService(repo).currentUser(),
    );
    expect(second.role).toBe(RoleDTO.VIEWER);
  });

  it("des comptes sans administrateur actif (seed de démo) : le prochain est ADMIN", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({
        id: "o",
        email: "demo@exemple.invalid",
        name: "Démo",
        role: RoleDTO.VIEWER,
      }),
    );
    const first = await as("vrai.admin@tekad.ch", () =>
      new AuthorizationService(repo).currentUser(),
    );
    expect(first.role).toBe(RoleDTO.ADMIN);
  });

  it("le machiniste saisit ses journées mais ne lit pas les statistiques", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({
        id: "a",
        email: "admin@x.ch",
        name: "A",
        role: RoleDTO.ADMIN,
      }),
    );
    await repo.create(
      User.create({
        id: "c",
        email: "c@x.ch",
        name: "C",
        role: RoleDTO.VIEWER,
      }),
    );
    await as("c@x.ch", async () => {
      const auth = new AuthorizationService(repo);
      await expect(
        auth.authorize(PermissionDTO.EXPENSE_VIEW),
      ).resolves.toBeTruthy();
      await expect(auth.authorize(PermissionDTO.EXPENSE_BOOK)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(
        auth.authorize([
          PermissionDTO.EXPENSE_BOOK,
          PermissionDTO.EXPENSE_VIEW,
        ]),
      ).resolves.toBeTruthy();
      await expect(auth.authorize("AUTHENTICATED")).resolves.toBeTruthy();
    });
  });

  it("un compte désactivé est refusé partout", async () => {
    const repo = new MemoryUsers();
    const user = User.create({
      id: "d",
      email: "d@x.ch",
      name: "D",
      role: RoleDTO.ACCOUNTANT,
      active: false,
    });
    await repo.create(user);
    await as("d@x.ch", async () => {
      await expect(
        new AuthorizationService(repo).authorize("AUTHENTICATED"),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  it("un rôle inconnu en base n'ouvre que la lecture", () => {
    const user = User.restore({
      id: "x",
      email: "x@x.ch",
      name: "X",
      role: "CHEF",
      active: true,
      createdAt: new Date(),
      lastSeenAt: null,
    });
    expect(user.permissions).toEqual([PermissionDTO.EXPENSE_VIEW]);
  });
});

describe("UserUseCases", () => {
  it("garde au moins un administrateur actif", async () => {
    const repo = new MemoryUsers();
    const admin = User.create({
      id: "a",
      email: "a@x.ch",
      name: "A",
      role: RoleDTO.ADMIN,
    });
    await repo.create(admin);
    const useCases = useCasesOf(repo);
    await expect(
      useCases.update("a", { role: RoleDTO.ACCOUNTANT }),
    ).rejects.toThrow(ConflictError);
    await useCases.create({ email: "b@x.ch", name: "B", role: RoleDTO.ADMIN });
    await expect(useCases.update("a", { active: false })).resolves.toBeTruthy();
  });

  it("rôles SWA : inconnu → USER, désactivé → aucun", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({
        id: "p",
        email: "p@x.ch",
        name: "P",
        role: RoleDTO.ACCOUNTANT,
      }),
    );
    await repo.create(
      User.create({
        id: "q",
        email: "q@x.ch",
        name: "Q",
        role: RoleDTO.ACCOUNTANT,
        active: false,
      }),
    );
    const useCases = useCasesOf(repo);
    expect(await useCases.rolesFor("P@x.ch")).toEqual([
      RoleDTO.ACCOUNTANT,
      "USER",
    ]);
    expect(await useCases.rolesFor("new@x.ch")).toEqual(["USER"]);
    expect(await useCases.rolesFor("q@x.ch")).toEqual([]);
  });

  it("modifie nom et e-mail, refuse une adresse déjà prise", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({ id: "a", email: "a@x.ch", name: "A", role: RoleDTO.ADMIN }),
    );
    await repo.create(
      User.create({
        id: "b",
        email: "b@x.ch",
        name: "B",
        role: RoleDTO.ACCOUNTANT,
      }),
    );
    const useCases = useCasesOf(repo);
    const { user: updated } = await useCases.update("b", {
      email: " B2@Partner.ch ",
      name: "Béa",
    });
    expect(updated.email).toBe("b2@partner.ch");
    expect(updated.name).toBe("Béa");
    expect(updated.entraTenantId).toBe("T-PARTNER");
    expect(await repo.findByEmail("b@x.ch")).toBeNull();
    await expect(useCases.update("b", { email: "a@x.ch" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("refuse un compte dont le domaine n'est pas autorisé", async () => {
    const repo = new MemoryUsers();
    const useCases = useCasesOf(repo);
    await expect(
      useCases.create({
        email: "x@refuse.ch",
        name: "X",
        role: RoleDTO.VIEWER,
      }),
    ).rejects.toThrow(/non autorisé/);
    expect(await repo.count()).toBe(0);
    const { user: created } = await useCases.create({
      email: "y@partner.ch",
      name: "Y",
      role: RoleDTO.VIEWER,
    });
    expect(created.entraTenantId).toBe("T-PARTNER");
    expect(created.entraGuest).toBe(false);
  });

  it("une adresse externe devient un invité du tenant de l'application", async () => {
    const repo = new MemoryUsers();
    const { user, entraAccess: access } = await useCasesOf(repo).create({
      email: "Marie@Gmail.com",
      name: "Marie",
      role: RoleDTO.ACCOUNTANT,
    });
    expect(access.outcome).toBe("GUEST_INVITED");
    expect(user).toMatchObject({
      email: "marie@gmail.com",
      entraTenantId: "T-HOME",
      entraGuest: true,
    });
  });

  it("suppression : jamais soi-même, le dernier admin, ni un compte qui a des journées", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({ id: "a", email: "a@x.ch", name: "A", role: RoleDTO.ADMIN }),
    );
    await repo.create(
      User.create({
        id: "o",
        email: "o@x.ch",
        name: "O",
        role: RoleDTO.VIEWER,
      }),
    );
    await repo.create(
      User.create({
        id: "n",
        email: "n@x.ch",
        name: "N",
        role: RoleDTO.VIEWER,
      }),
    );
    repo.activity.set("o", 3);
    const useCases = useCasesOf(repo);
    await expect(useCases.delete("a", "a")).rejects.toThrow(/propre compte/);
    await expect(useCases.delete("a", "n")).rejects.toThrow(/dernier/);
    await expect(useCases.delete("o", "a")).rejects.toThrow(/désactivez-le/);
    await useCases.delete("n", "a");
    expect(await repo.findById("n")).toBeNull();
    await expect(useCases.delete("n", "a")).rejects.toThrow(NotFoundError);
  });

  it("invitation : compte actif seulement", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({ id: "a", email: "a@x.ch", name: "A", role: RoleDTO.ADMIN }),
    );
    await repo.create(
      User.create({
        id: "q",
        email: "q@x.ch",
        name: "Q",
        role: RoleDTO.ACCOUNTANT,
        active: false,
      }),
    );
    const useCases = useCasesOf(repo);
    await expect(useCases.sendInvitation("a")).resolves.toEqual({
      outcome: "SENT",
    });
    expect(sent).toContain("a@x.ch");
    await expect(useCases.sendInvitation("q")).rejects.toThrow(/désactivé/);
  });

  it("rôles SWA : un jeton d'un autre tenant n'ouvre pas un compte vérifié", async () => {
    const repo = new MemoryUsers();
    await repo.create(
      User.create({
        id: "p",
        email: "p@partner.ch",
        name: "P",
        role: RoleDTO.ACCOUNTANT,
        entraTenantId: "T-PARTNER",
      }),
    );
    const useCases = useCasesOf(repo);
    expect(await useCases.rolesFor("p@partner.ch", "t-partner")).toEqual([
      RoleDTO.ACCOUNTANT,
      "USER",
    ]);
    expect(await useCases.rolesFor("p@partner.ch", "T-OTHER")).toEqual([]);
  });
});
