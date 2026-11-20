import { RoleDTO, isRole, rolePermissions, PermissionDTO } from "@repo/models";
import { ValidationError } from "@/shared/domain/errors.js";

export interface UserProps {
  id: string;
  email: string;
  name: string;
  role: RoleDTO;
  active: boolean;
  /** Reçoit les e-mails de l'application. */
  notificationsEnabled: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  /** Tenant Entra ID vérifié pour l'adresse ; `null` = non vérifié. */
  entraTenantId: string | null;
  /** Invité externe (B2B) ajouté au tenant de l'application. */
  entraGuest: boolean;
}

/**
 * Compte de l'application. L'e-mail (celui du principal Azure) l'identifie ;
 * le rôle dit ce qu'il peut faire, par les permissions de @repo/models.
 */
export class User {
  private constructor(private props: UserProps) {}

  static restore(
    props: Omit<
      UserProps,
      "role" | "notificationsEnabled" | "entraTenantId" | "entraGuest"
    > & {
      role: string;
      notificationsEnabled?: boolean;
      entraTenantId?: string | null;
      entraGuest?: boolean;
    },
  ): User {
    // Un code inconnu en base n'ouvre que la lecture.
    const role = isRole(props.role) ? props.role : RoleDTO.VIEWER;
    return new User({
      ...props,
      role,
      notificationsEnabled: props.notificationsEnabled ?? true,
      entraTenantId: props.entraTenantId ?? null,
      entraGuest: props.entraGuest ?? false,
    });
  }

  static create(input: {
    id: string;
    email: string;
    name: string;
    role: RoleDTO;
    active?: boolean;
    entraTenantId?: string | null;
    entraGuest?: boolean;
    now?: Date;
  }): User {
    const email = User.normalizeEmail(input.email);
    const name = input.name.trim();
    if (!name) throw new ValidationError("le nom est requis");
    return new User({
      id: input.id,
      email,
      name,
      role: input.role,
      active: input.active ?? true,
      notificationsEnabled: true,
      createdAt: input.now ?? new Date(),
      lastSeenAt: null,
      entraTenantId: input.entraTenantId ?? null,
      entraGuest: input.entraGuest ?? false,
    });
  }

  static normalizeEmail(email: string): string {
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) throw new ValidationError("e-mail invalide");
    return value;
  }

  /** Nom lisible tiré d'un e-mail (`jean.dupont@…` → `Jean Dupont`). */
  static nameFromEmail(email: string): string {
    return email
      .split("@")[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  get id() {
    return this.props.id;
  }
  get email() {
    return this.props.email;
  }
  get name() {
    return this.props.name;
  }
  get role() {
    return this.props.role;
  }
  get active() {
    return this.props.active;
  }
  get notificationsEnabled() {
    return this.props.notificationsEnabled;
  }
  /** Un e-mail ne part que vers un compte actif qui ne l'a pas refusé. */
  get reachable(): boolean {
    return this.props.active && this.props.notificationsEnabled;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get lastSeenAt() {
    return this.props.lastSeenAt;
  }
  get entraTenantId() {
    return this.props.entraTenantId;
  }

  get entraGuest() {
    return this.props.entraGuest;
  }

  get permissions(): PermissionDTO[] {
    return this.props.active ? rolePermissions(this.props.role) : [];
  }

  update(patch: {
    email?: string;
    name?: string;
    role?: RoleDTO;
    active?: boolean;
    notificationsEnabled?: boolean;
  }): void {
    if (patch.email !== undefined) {
      this.props.email = User.normalizeEmail(patch.email);
    }
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new ValidationError("le nom est requis");
      this.props.name = name;
    }
    if (patch.role !== undefined) this.props.role = patch.role;
    if (patch.active !== undefined) this.props.active = patch.active;
    if (patch.notificationsEnabled !== undefined) {
      this.props.notificationsEnabled = patch.notificationsEnabled;
    }
  }

  /** Retient le tenant vérifié de l'adresse (`null` : non vérifié) et s'il s'agit d'un invité. */
  bindEntraTenant(tenantId: string | null, guest = false): void {
    this.props.entraTenantId = tenantId;
    this.props.entraGuest = guest;
  }

  /**
   * Vrai quand un jeton émis par ce tenant peut ouvrir le compte : le tenant
   * vérifié, ou n'importe lequel si rien n'a été vérifié.
   */
  acceptsTenant(tenantId: string | undefined): boolean {
    if (!this.props.entraTenantId) return true;
    return (
      !!tenantId &&
      tenantId.toLowerCase() === this.props.entraTenantId.toLowerCase()
    );
  }

  touch(now: Date): void {
    this.props.lastSeenAt = now;
  }
}
