/**
 * Ce que l'application lit d'Entra ID (Microsoft Graph, permissions
 * d'application) et les deux seules écritures : inviter un externe et
 * l'affecter à l'application. Un port : la règle (`EntraAccessChecker`)
 * n'en connaît que ces opérations.
 */
export interface IEntraDirectory {
  /** Faux quand Graph n'est pas configuré (développement) : rien n'est vérifié. */
  isConfigured(): boolean;

  /** Le tenant qui porte l'App Registration (`ENTRA_TENANT_ID`). */
  homeTenantId(): string;

  /** L'App Registration de l'application et son application d'entreprise. */
  getApplication(): Promise<EntraApplication>;

  /** Le tenant Entra qui possède ce domaine ; `null` s'il n'y en a pas (gmail.com…). */
  findTenantByDomain(domain: string): Promise<EntraTenant | null>;

  /** Nom et domaine d'un tenant ; `null` s'il est inconnu. */
  findTenantById(tenantId: string): Promise<EntraTenant | null>;

  /**
   * Invite l'adresse comme invitée (B2B) du tenant, **sans e-mail de
   * Microsoft** (`sendInvitationMessage: false`) : elle accepte à sa
   * première connexion. Idempotent : un invité existant est rendu tel quel.
   */
  inviteGuest(input: {
    email: string;
    displayName: string;
    redirectUrl: string;
  }): Promise<{ userId: string }>;

  /** Affecte l'utilisateur à l'application d'entreprise (rôle par défaut). */
  assignToApplication(userId: string): Promise<void>;
}

export interface EntraApplication {
  appId: string;
  displayName: string;
  /** `AzureADMyOrg`, `AzureADMultipleOrgs`, `AzureADandPersonalMicrosoftAccount`, `PersonalMicrosoftAccount`. */
  signInAudience: string;
  /**
   * Les tenants autorisés d'une application multi-tenant restreinte
   * (`signInAudienceRestrictions`, « Allow only certain tenants ») ;
   * `null` quand aucune restriction n'est posée.
   */
  allowedTenantIds: string[] | null;
  /** L'application d'entreprise exige une affectation. */
  assignmentRequired: boolean;
}

export interface EntraTenant {
  tenantId: string;
  displayName?: string;
  defaultDomainName?: string;
}
