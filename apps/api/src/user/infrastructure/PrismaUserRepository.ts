import { inject, injectable } from "inversify";
import type { PrismaClient, UserDB } from "@generated/prisma/client.js";
import { RoleDTO } from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import { User } from "@/user/domain/User.js";
import type { IUserRepository } from "@/user/application/repositories/IUserRepository.js";

const toDomain = (row: UserDB): User =>
  User.restore({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    notificationsEnabled: row.notifications_enabled,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    entraTenantId: row.entra_tenant_id,
    entraGuest: row.entra_guest,
  });

@injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.userDB.findUnique({
      where: { id },
    });
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.userDB.findUnique({
      where: { email },
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<User[]> {
    const rows = await this.prisma.userDB.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  count(): Promise<number> {
    return this.prisma.userDB.count();
  }

  async countActivity(id: string): Promise<number> {
    const [runs, booked] = await Promise.all([
      this.prisma.syncRunDB.count({ where: { triggered_by_id: id } }),
      this.prisma.expenseDB.count({ where: { booked_by_id: id } }),
    ]);
    return runs + booked;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userDB.delete({ where: { id } });
  }

  countActiveAdmins(): Promise<number> {
    return this.prisma.userDB.count({
      where: { role: RoleDTO.ADMIN, active: true },
    });
  }

  async create(user: User): Promise<void> {
    try {
      await this.prisma.userDB.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
          notifications_enabled: user.notificationsEnabled,
          created_at: user.createdAt,
          last_seen_at: user.lastSeenAt,
          entra_tenant_id: user.entraTenantId,
          entra_guest: user.entraGuest,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictError(`un compte existe déjà pour ${user.email}`);
      }
      throw error;
    }
  }

  async update(user: User): Promise<void> {
    try {
      await this.prisma.userDB.update({
        where: { id: user.id },
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
          notifications_enabled: user.notificationsEnabled,
          entra_tenant_id: user.entraTenantId,
          entra_guest: user.entraGuest,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictError(`un compte existe déjà pour ${user.email}`);
      }
      throw error;
    }
  }

  async markSeen(id: string, at: Date): Promise<void> {
    await this.prisma.userDB.update({
      where: { id },
      data: { last_seen_at: at },
    });
  }
}
