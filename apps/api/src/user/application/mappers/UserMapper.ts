import type { CurrentUserDTO, UserDTO, UserOptionDTO } from "@repo/models";
import type { User } from "@/user/domain/User.js";

export const UserMapper = {
  toDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      notificationsEnabled: user.notificationsEnabled,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      entraTenantId: user.entraTenantId,
      entraGuest: user.entraGuest,
    };
  },
  toCurrentDTO(user: User): CurrentUserDTO {
    return { ...UserMapper.toDTO(user), permissions: user.permissions };
  },
  toOption(user: User): UserOptionDTO {
    return { id: user.id, name: user.name, email: user.email };
  },
};
