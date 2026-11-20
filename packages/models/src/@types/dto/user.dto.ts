import type { PermissionDTO, RoleDTO } from "../authorization.js";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: RoleDTO;
  active: boolean;
  /** Reçoit les e-mails de l'application. */
  notificationsEnabled: boolean;
  createdAt: string;
  lastSeenAt?: string | null;
  /**
   * Tenant Entra ID vérifié pour l'adresse (domaine → tenant) ; seul un jeton
   * de ce tenant ouvre le compte. `null` : non vérifié (Graph non configuré,
   * compte créé à sa première connexion).
   */
  entraTenantId?: string | null;
  /** Invité externe (B2B) du tenant de l'application, ajouté par l'application. */
  entraGuest?: boolean;
  /** Réponse de création / changement d'adresse : ce que la vérification Entra a fait. */
  entraAccess?: EntraAccessDTO;
}

/** `GET users/me` : le compte et ses permissions résolues par l'API. */
export interface CurrentUserDTO extends UserDTO {
  permissions: PermissionDTO[];
}

/** Liste courte pour les sélecteurs. */
export interface UserOptionDTO {
  id: string;
  name: string;
  email: string;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  role: RoleDTO;
  active?: boolean;
}

export interface UpdateUserDTO {
  /** Changer l'adresse revérifie son tenant Entra ID (409 s'il n'est pas autorisé). */
  email?: string;
  name?: string;
  role?: RoleDTO;
  active?: boolean;
  notificationsEnabled?: boolean;
}

/** `PUT users/me/preferences` : ce que chacun règle pour lui-même. */
export interface UpdateMyPreferencesDTO {
  notificationsEnabled: boolean;
}

/**
 * Ce que la vérification Entra ID a constaté, à la création d'un compte ou
 * au changement de son adresse :
 * - `NOT_CONFIGURED` : Graph n'est pas configuré, rien n'a été vérifié ;
 * - `HOME_TENANT` : l'adresse appartient au tenant de l'App Registration ;
 * - `ALLOWED_TENANT` : elle appartient à un tenant que l'App Registration
 *   autorise.
 * - `GUEST_INVITED` : ni l'un ni l'autre (gmail.com, autre entreprise…) :
 *   la personne est invitée comme invitée (B2B) dans le tenant de
 *   l'application, **sans e-mail de Microsoft** ; elle se connecte avec un
 *   code reçu par e-mail et accepte l'invitation à sa première connexion.
 */
export type EntraAccessOutcomeDTO =
  "NOT_CONFIGURED" | "HOME_TENANT" | "ALLOWED_TENANT" | "GUEST_INVITED";

export interface EntraTenantDTO {
  tenantId: string;
  displayName?: string;
  defaultDomainName?: string;
}

export interface EntraAccessDTO {
  outcome: EntraAccessOutcomeDTO;
  /** Le tenant du domaine de l'adresse, retenu sur le compte. */
  tenant?: EntraTenantDTO;
  /**
   * Invité créé mais pas affecté à l'application d'entreprise (affectation
   * requise, permission manquante…) : le message dit quoi faire dans Entra.
   */
  assignmentError?: string;
}

/** `GET users/entra-access` : qui peut se connecter, d'après l'App Registration. */
export interface EntraAccessSettingsDTO {
  /** Faux sans configuration Graph : le reste est absent. */
  configured: boolean;
  application?: {
    appId: string;
    displayName: string;
    /** `AzureADMyOrg`, `AzureADMultipleOrgs`, `AzureADandPersonalMicrosoftAccount`, `PersonalMicrosoftAccount`. */
    signInAudience: string;
    /** L'application d'entreprise exige une affectation. */
    assignmentRequired: boolean;
  };
  /** Le tenant de l'App Registration, toujours autorisé. */
  homeTenant?: EntraTenantDTO;
  /**
   * Les autres tenants autorisés (« Allow only certain tenants ») ; `null` =
   * tous (multi-tenant sans restriction) ; vide pour une application
   * mono-tenant.
   */
  allowedTenants?: EntraTenantDTO[] | null;
}

/**
 * `POST users/{id}/invitation` : envoyé, messagerie non configurée
 * (`ACS_*`, `APP_PUBLIC_URL`) ou échec de l'envoi.
 */
export type UserInvitationOutcomeDTO = "SENT" | "NOT_CONFIGURED" | "FAILED";

export interface UserInvitationDTO {
  outcome: UserInvitationOutcomeDTO;
}
