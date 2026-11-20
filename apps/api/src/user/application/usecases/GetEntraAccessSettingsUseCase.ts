import { inject, injectable } from "inversify";
import { EntraAccessSettingsDTO, EntraTenantDTO } from "@repo/models";
import { log } from "@/shared/infrastructure/logging/logger.js";
import { IEntraDirectory } from "@/user/application/services/IEntraDirectory.js";
import { sameTenant } from "@/user/application/services/EntraAccessChecker.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";

/**
 * Qui peut se connecter, lu dans l'App Registration : son audience, le
 * tenant d'origine et les tenants autorisés, nommés quand Entra les connaît.
 */
@injectable()
export class GetEntraAccessSettingsUseCase {
  constructor(
    @inject(USER_TYPES.IEntraDirectory)
    private directory: IEntraDirectory,
  ) {}

  async execute(): Promise<EntraAccessSettingsDTO> {
    if (!this.directory.isConfigured()) return { configured: false };

    const home = this.directory.homeTenantId();
    const application = await this.directory.getApplication();

    const multiTenant =
      application.signInAudience === "AzureADMultipleOrgs" ||
      application.signInAudience === "AzureADandPersonalMicrosoftAccount";

    const [homeTenant, allowedTenants] = await Promise.all([
      this.describeTenant(home),
      !multiTenant
        ? Promise.resolve([])
        : application.allowedTenantIds === null
          ? Promise.resolve(null)
          : Promise.all(
              application.allowedTenantIds
                .filter((id) => !sameTenant(id, home))
                .map((id) => this.describeTenant(id)),
            ),
    ]);

    return {
      configured: true,
      application: {
        appId: application.appId,
        displayName: application.displayName,
        signInAudience: application.signInAudience,
        assignmentRequired: application.assignmentRequired,
      },
      homeTenant,
      allowedTenants,
    };
  }

  /** Un tenant qu'Entra ne sait pas nommer reste affiché par son identifiant. */
  private async describeTenant(tenantId: string): Promise<EntraTenantDTO> {
    try {
      return (await this.directory.findTenantById(tenantId)) ?? { tenantId };
    } catch (error) {
      log.warn(`[entra] tenant ${tenantId} non résolu :`, error);
      return { tenantId };
    }
  }
}
