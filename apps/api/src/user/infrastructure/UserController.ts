import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  createUserSchema,
  updateMyPreferencesSchema,
  updateUserSchema,
  type RolesRequestDTO,
} from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { pathId } from "@/shared/infrastructure/http/query.js";
import {
  created,
  noContent,
  ok,
} from "@/shared/infrastructure/http/responses.js";
import { UserMapper } from "@/user/application/mappers/UserMapper.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { UserUseCases } from "@/user/application/usecases/UserUseCases.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";
import type { GetEntraAccessSettingsUseCase } from "@/user/application/usecases/GetEntraAccessSettingsUseCase.js";

/** Le tenant du jeton, sous son nom long (Static Web Apps) ou court. */
const TENANT_ID_CLAIMS = [
  "http://schemas.microsoft.com/identity/claims/tenantid",
  "tid",
];

@injectable()
export class UserController {
  constructor(
    @inject(USER_TYPES.UserUseCases) private useCases: UserUseCases,
    @inject(USER_TYPES.IAuthorizationService)
    private authorization: IAuthorizationService,
    @inject(USER_TYPES.GetEntraAccessSettingsUseCase)
    private entraSettings: GetEntraAccessSettingsUseCase,
  ) {}

  /** GET users/me */
  async me(): Promise<HttpResponseInit> {
    const user = await this.authorization.currentUser();
    return ok(UserMapper.toCurrentDTO(user));
  }

  /** PUT users/me/preferences */
  async updatePreferences(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updateMyPreferencesSchema);
    const user = await this.authorization.currentUser();
    const updated = await this.useCases.updatePreferences(user, body);
    return ok(UserMapper.toCurrentDTO(updated));
  }

  /** GET users/options */
  async options(): Promise<HttpResponseInit> {
    const users = await this.useCases.options();
    return ok(users.map(UserMapper.toOption));
  }

  /** GET users */
  async list(): Promise<HttpResponseInit> {
    const users = await this.useCases.list();
    return ok(users.map(UserMapper.toDTO));
  }

  /** POST users */
  async create(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, createUserSchema);
    const { user, entraAccess } = await this.useCases.create(body);
    return created({ ...UserMapper.toDTO(user), entraAccess });
  }

  /** PUT users/{id} */
  async update(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updateUserSchema);
    const { user, entraAccess } = await this.useCases.update(
      pathId(request),
      body,
    );
    return ok({ ...UserMapper.toDTO(user), entraAccess });
  }

  /** DELETE users/{id} */
  async delete(request: HttpRequest): Promise<HttpResponseInit> {
    const me = await this.authorization.currentUser();
    await this.useCases.delete(pathId(request), me.id);
    return noContent();
  }

  /** POST users/{id}/invitation */
  async sendInvitation(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.sendInvitation(pathId(request)));
  }

  /** GET users/entra-access */
  async entraAccess(): Promise<HttpResponseInit> {
    return ok(await this.entraSettings.execute());
  }

  /**
   * POST roles — `rolesSource` d'Azure Static Web Apps, appelé avant que la
   * session n'existe : ne fait que lire.
   */
  async extractRoles(request: HttpRequest): Promise<HttpResponseInit> {
    let body: Partial<RolesRequestDTO> = {};
    try {
      body = ((await request.json()) ?? {}) as Partial<RolesRequestDTO>;
    } catch {
      body = {};
    }
    const tenantId = Array.isArray(body.claims)
      ? body.claims.find((claim) => TENANT_ID_CLAIMS.includes(claim?.typ))?.val
      : undefined;
    const roles = await this.useCases.rolesFor(body.userDetails, tenantId);
    return ok({ roles });
  }
}
