import { injectable } from "inversify";
import {
  InternalServerError,
  InvalidStateError,
} from "@/shared/domain/errors.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import {
  EntraApplication,
  EntraTenant,
  IEntraDirectory,
} from "@/user/application/services/IEntraDirectory.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
/**
 * `signInAudienceRestrictions` (« Allow only certain tenants ») n'existe
 * qu'en beta : seule la lecture de l'App Registration y passe.
 */
const GRAPH_BETA = "https://graph.microsoft.com/beta";
const TIMEOUT_MS = 10_000;

const REQUIRED_SETTINGS = [
  "ENTRA_TENANT_ID",
  "ENTRA_GRAPH_CLIENT_ID",
  "ENTRA_GRAPH_CLIENT_SECRET",
  "ENTRA_APP_CLIENT_ID",
] as const;

interface EntraSettings {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  appClientId: string;
}

/** Le jeton d'application, gardé par processus jusqu'à une minute de sa fin. */
let cachedToken: { key: string; value: string; expiresAt: number } | null =
  null;

/**
 * Entra ID par Microsoft Graph, en client credentials
 * (`ENTRA_GRAPH_CLIENT_ID` / `ENTRA_GRAPH_CLIENT_SECRET` dans
 * `ENTRA_TENANT_ID`). Permissions d'application consenties par un
 * administrateur : `Application.Read.All` (l'App Registration et son
 * application d'entreprise), `CrossTenantInformation.ReadBasic.All` (le
 * tenant d'un domaine, le nom d'un tenant) et, pour les invités externes,
 * `User.Invite.All` (inviter sans e-mail Microsoft) et
 * `AppRoleAssignment.ReadWrite.All` (affecter l'invité à l'application quand
 * l'affectation est requise ; sans elle, l'affectation se fait à la main).
 *
 * Sans App Registration Graph (`ENTRA_GRAPH_CLIENT_ID` et `_SECRET` vides) :
 * non configuré, rien n'est vérifié. Une configuration
 * partielle est une erreur (409) plutôt qu'un silence : en production, elle
 * laisserait croire les comptes vérifiés.
 */
@injectable()
export class GraphEntraDirectory implements IEntraDirectory {
  isConfigured(): boolean {
    return readSettings() !== null;
  }

  homeTenantId(): string {
    return requireSettings().tenantId;
  }

  async getApplication(): Promise<EntraApplication> {
    const { appClientId } = requireSettings();
    const id = odataString(appClientId);
    const [application, servicePrincipal] = await Promise.all([
      graph<{
        appId: string;
        displayName: string;
        signInAudience: string;
        signInAudienceRestrictions?: {
          "@odata.type"?: string;
          allowedTenantIds?: string[];
        } | null;
      } | null>(
        `/applications(appId=${id})?$select=appId,displayName,signInAudience,signInAudienceRestrictions`,
        { allowNotFound: true, base: GRAPH_BETA },
      ),
      graph<{ appRoleAssignmentRequired?: boolean } | null>(
        `/servicePrincipals(appId=${id})?$select=appRoleAssignmentRequired`,
        { allowNotFound: true },
      ),
    ]);
    if (!application) {
      throw new InvalidStateError(
        `App Registration ${appClientId} introuvable dans le tenant (ENTRA_APP_CLIENT_ID)`,
      );
    }

    const restrictions = application.signInAudienceRestrictions;
    return {
      appId: application.appId,
      displayName: application.displayName,
      signInAudience: application.signInAudience,
      allowedTenantIds:
        restrictions?.["@odata.type"] ===
        "#microsoft.graph.allowedTenantsAudience"
          ? (restrictions.allowedTenantIds ?? [])
          : null,
      assignmentRequired: servicePrincipal?.appRoleAssignmentRequired === true,
    };
  }

  async findTenantByDomain(domain: string): Promise<EntraTenant | null> {
    return tenantInformation(
      `findTenantInformationByDomainName(domainName=${odataString(domain)})`,
    );
  }

  async findTenantById(tenantId: string): Promise<EntraTenant | null> {
    return tenantInformation(
      `findTenantInformationByTenantId(tenantId=${odataString(tenantId)})`,
    );
  }

  async inviteGuest(input: {
    email: string;
    displayName: string;
    redirectUrl: string;
  }): Promise<{ userId: string }> {
    const invitation = await graph<{ invitedUser: { id: string } }>(
      "/invitations",
      {
        method: "POST",
        body: {
          invitedUserEmailAddress: input.email,
          invitedUserDisplayName: input.displayName,
          inviteRedirectUrl: input.redirectUrl,
          // L'application envoie sa propre invitation : pas d'e-mail Microsoft.
          sendInvitationMessage: false,
        },
        action: "l'invitation",
      },
    );
    return { userId: invitation.invitedUser.id };
  }

  async assignToApplication(userId: string): Promise<void> {
    const { appClientId } = requireSettings();
    const servicePrincipal = await graph<{ id: string } | null>(
      `/servicePrincipals(appId=${odataString(appClientId)})?$select=id`,
      { allowNotFound: true },
    );
    if (!servicePrincipal) {
      throw new InvalidStateError(
        "Application d'entreprise introuvable : affectez l'invité à la main dans Entra ID",
      );
    }
    const existing = await graph<{ value: { appRoleId: string }[] }>(
      `/users/${encodeURIComponent(userId)}/appRoleAssignments?$filter=resourceId eq ${servicePrincipal.id}`,
    );
    if (existing.value.length > 0) return;
    await graph(`/servicePrincipals/${servicePrincipal.id}/appRoleAssignedTo`, {
      method: "POST",
      body: {
        principalId: userId,
        resourceId: servicePrincipal.id,
        // Rôle par défaut : l'application n'en déclare pas.
        appRoleId: "00000000-0000-0000-0000-000000000000",
      },
      action: "l'affectation à l'application",
    });
  }
}

async function tenantInformation(
  operation: string,
): Promise<EntraTenant | null> {
  const tenant = await graph<{
    tenantId: string;
    displayName?: string | null;
    defaultDomainName?: string | null;
  } | null>(`/tenantRelationships/${operation}`, { allowNotFound: true });
  return tenant
    ? {
        tenantId: tenant.tenantId,
        displayName: tenant.displayName ?? undefined,
        defaultDomainName: tenant.defaultDomainName ?? undefined,
      }
    : null;
}

function readSettings(): EntraSettings | null {
  const values = REQUIRED_SETTINGS.map((name) => process.env[name]?.trim());
  // Le tenant et l'App Registration de la connexion sont toujours déployés
  // (ENTRA-TENANT-ID, ENTRA-CLIENT-ID) : c'est l'App Registration Graph qui
  // dit si la vérification est en service.
  if (
    !process.env.ENTRA_GRAPH_CLIENT_ID?.trim() &&
    !process.env.ENTRA_GRAPH_CLIENT_SECRET?.trim()
  ) {
    return null;
  }
  const missing = REQUIRED_SETTINGS.filter((_, index) => !values[index]);
  if (missing.length > 0) {
    throw new InvalidStateError(
      `Configuration Entra incomplète : ${missing.join(", ")}`,
    );
  }
  const [tenantId, clientId, clientSecret, appClientId] = values as string[];
  return { tenantId, clientId, clientSecret, appClientId };
}

function requireSettings(): EntraSettings {
  const settings = readSettings();
  if (!settings) throw new InvalidStateError("Entra n'est pas configuré");
  return settings;
}

/** Littéral de chaîne OData : apostrophes doublées. */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function accessToken(settings: EntraSettings): Promise<string> {
  const key = `${settings.tenantId}:${settings.clientId}`;
  if (
    cachedToken &&
    cachedToken.key === key &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.value;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(settings.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  ).catch((error) => {
    log.error("[entra] point de jeton injoignable :", error);
    throw new InternalServerError("Entra unavailable");
  });

  if (!response.ok) {
    log.error(
      `[entra] jeton Graph refusé (${response.status}) : ${await response.text()}`,
    );
    throw new InvalidStateError(
      "Connexion à Microsoft Graph refusée : vérifiez ENTRA_GRAPH_CLIENT_ID et ENTRA_GRAPH_CLIENT_SECRET",
    );
  }

  const body = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    key,
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

interface GraphRequest {
  allowNotFound?: boolean;
  base?: string;
  method?: "GET" | "POST";
  body?: unknown;
  /** Ce que la requête fait, pour le message d'erreur (« la lecture » par défaut). */
  action?: string;
}

async function graph<T>(path: string, request: GraphRequest = {}): Promise<T> {
  const token = await accessToken(requireSettings());
  const response = await fetch(`${request.base ?? GRAPH}${path}`, {
    method: request.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(request.body ? { "Content-Type": "application/json" } : {}),
    },
    body: request.body ? JSON.stringify(request.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((error) => {
    log.error("[entra] Microsoft Graph injoignable :", error);
    throw new InternalServerError("Microsoft Graph unavailable");
  });

  if (response.status === 404 && request.allowNotFound) return null as T;

  if (!response.ok) {
    const message = await graphErrorMessage(response);
    log.error(
      `[entra] Graph ${path.split("?")[0]} → ${response.status} : ${message}`,
    );
    // Message écrit par Entra pour être lu (permission manquante…) : on le
    // transmet plutôt qu'un 500 muet.
    throw new InvalidStateError(
      `Entra ID a refusé ${request.action ?? "la lecture"} : ${message}`,
    );
  }

  return (await response.json()) as T;
}

async function graphErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: { message?: string } };
    return body.error?.message ?? text;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}
