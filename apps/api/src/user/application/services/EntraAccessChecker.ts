import { inject, injectable } from "inversify";
import { EntraAccessDTO } from "@repo/models";
import { InvalidStateError } from "@/shared/domain/errors.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import {
  EntraApplication,
  IEntraDirectory,
} from "@/user/application/services/IEntraDirectory.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";

/** Les audiences qui acceptent des comptes d'autres tenants que celui de l'application. */
const MULTI_TENANT_AUDIENCES = new Set([
  "AzureADMultipleOrgs",
  "AzureADandPersonalMicrosoftAccount",
]);

/**
 * Vrai quand l'App Registration laisse entrer les comptes de ce tenant : le
 * tenant d'origine toujours (sauf application réservée aux comptes
 * personnels), un autre si l'application est multi-tenant, sans restriction
 * ou avec ce tenant parmi les autorisés.
 */
export function acceptsTenant(
  application: EntraApplication,
  homeTenantId: string,
  tenantId: string,
): boolean {
  if (application.signInAudience === "PersonalMicrosoftAccount") return false;
  if (sameTenant(tenantId, homeTenantId)) return true;
  if (!MULTI_TENANT_AUDIENCES.has(application.signInAudience)) return false;
  return (
    application.allowedTenantIds === null ||
    application.allowedTenantIds.some((id) => sameTenant(id, tenantId))
  );
}

export function sameTenant(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Vérifie, avant qu'un compte soit créé ou change d'adresse, qu'il pourra se
 * connecter — et, sinon, l'invite.
 *
 * La connexion passe par l'émetteur du tenant de l'application
 * (`login.microsoftonline.com/<ENTRA_TENANT_ID>`, `staticwebapp.config.json`) :
 * y entrent ses comptes et ses **invités**. Une adresse d'un autre domaine
 * (gmail.com, une autre entreprise…) est donc invitée comme invitée (B2B),
 * **sans e-mail de Microsoft** (l'application envoie le sien) ; la personne
 * se connecte avec son compte Microsoft ou un code reçu par e-mail et accepte
 * l'invitation à sa première connexion. Quand l'application d'entreprise
 * exige une affectation, l'invité y est affecté ; un échec ne bloque pas la
 * création (`assignmentError` dit quoi faire).
 *
 * Le tenant rendu est retenu sur le compte : l'extracteur de rôles refuse un
 * jeton d'un autre tenant qui porterait la même adresse. Pour un invité,
 * c'est le tenant de l'application (celui de ses jetons).
 */
@injectable()
export class EntraAccessChecker {
  constructor(
    @inject(USER_TYPES.IEntraDirectory)
    private directory: IEntraDirectory,
  ) {}

  async check(email: string, displayName = email): Promise<EntraAccessDTO> {
    if (!this.directory.isConfigured()) {
      log.warn(
        `[entra] Graph non configuré : accès de ${email} non vérifié dans Entra`,
      );
      return { outcome: "NOT_CONFIGURED" };
    }

    const domain = email.trim().toLowerCase().split("@")[1];
    const [application, tenant] = await Promise.all([
      this.directory.getApplication(),
      this.directory.findTenantByDomain(domain),
    ]);
    if (application.signInAudience === "PersonalMicrosoftAccount") {
      throw new InvalidStateError(
        `L'App Registration « ${application.displayName} » n'accepte que des comptes Microsoft personnels`,
      );
    }

    const home = this.directory.homeTenantId();
    if (tenant && sameTenant(tenant.tenantId, home)) {
      return { outcome: "HOME_TENANT", tenant };
    }

    const { userId } = await this.directory.inviteGuest({
      email: email.trim().toLowerCase(),
      displayName,
      redirectUrl:
        process.env.APP_PUBLIC_URL?.trim() || "https://myapps.microsoft.com",
    });
    log.info(
      `[entra] ${email} invité(e) dans le tenant (sans e-mail Microsoft)`,
    );

    let assignmentError: string | undefined;
    if (application.assignmentRequired) {
      try {
        await this.directory.assignToApplication(userId);
      } catch (error) {
        assignmentError =
          `Invité créé mais pas affecté à l'application « ${application.displayName} » : affectez-le dans Entra ID (Applications d'entreprise → Utilisateurs et groupes). ${error instanceof Error ? error.message : ""}`.trim();
        log.warn(`[entra] ${assignmentError}`);
      }
    }
    const homeTenant = (await this.directory.findTenantById(home)) ?? {
      tenantId: home,
    };
    return {
      outcome: "GUEST_INVITED",
      tenant: homeTenant,
      ...(assignmentError ? { assignmentError } : {}),
    };
  }
}
