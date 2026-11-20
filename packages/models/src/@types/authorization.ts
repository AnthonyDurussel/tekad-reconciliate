/**
 * Rôles et permissions — source unique de vérité.
 *
 * Tekad : réconciliation des frais entre Revolut Business, UBS, le compte
 * courant d'Anthony et bexio. L'administrateur règle tout, le ou la
 * comptable (fiduciaire) traite et comptabilise les pièces, un lecteur
 * consulte. **Le code métier ne teste jamais un rôle** : il demande une
 * permission.
 */
export enum RoleDTO {
  ADMIN = "ADMIN",
  ACCOUNTANT = "ACCOUNTANT",
  VIEWER = "VIEWER",
}

export enum PermissionDTO {
  /** Lire les pièces, les transactions Revolut et le tableau de bord. */
  EXPENSE_VIEW = "EXPENSE_VIEW",
  /** Classer une pièce (compte, type, imputation), rapprocher, ignorer. */
  EXPENSE_MANAGE = "EXPENSE_MANAGE",
  /** Passer l'écriture dans bexio (ou la marquer comptabilisée). */
  EXPENSE_BOOK = "EXPENSE_BOOK",
  /** Lancer les imports : inbox bexio, lecture des pièces, Revolut. */
  SYNC_RUN = "SYNC_RUN",
  /** Comptes de paiement, cartes, types de dépense et leurs comptes bexio. */
  SETTINGS_MANAGE = "SETTINGS_MANAGE",
  /** Comptes et rôles. */
  USER_MANAGE = "USER_MANAGE",
}

export const ALL_PERMISSIONS: PermissionDTO[] = Object.values(PermissionDTO);

/** Marqueur d'accès à l'application ajouté par l'extracteur de rôles. */
export const APPLICATION_ACCESS_ROLE = "USER";

export const ROLE_PERMISSIONS: Record<RoleDTO, PermissionDTO[]> = {
  [RoleDTO.ADMIN]: ALL_PERMISSIONS,
  [RoleDTO.ACCOUNTANT]: [
    PermissionDTO.EXPENSE_VIEW,
    PermissionDTO.EXPENSE_MANAGE,
    PermissionDTO.EXPENSE_BOOK,
    PermissionDTO.SYNC_RUN,
  ],
  [RoleDTO.VIEWER]: [PermissionDTO.EXPENSE_VIEW],
};

export function isRole(value: string): value is RoleDTO {
  return (Object.values(RoleDTO) as string[]).includes(value);
}

/** Permissions effectives d'un rôle ; un code inconnu n'ouvre rien. */
export function rolePermissions(
  role: string | null | undefined,
): PermissionDTO[] {
  if (!role || !isRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(
  permissions: readonly PermissionDTO[] | undefined,
  permission: PermissionDTO,
): boolean {
  return !!permissions?.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly PermissionDTO[] | undefined,
  required: readonly PermissionDTO[],
): boolean {
  return (
    required.length === 0 || required.some((p) => hasPermission(permissions, p))
  );
}

export function hasEveryPermission(
  permissions: readonly PermissionDTO[] | undefined,
  required: readonly PermissionDTO[],
): boolean {
  return required.every((p) => hasPermission(permissions, p));
}
