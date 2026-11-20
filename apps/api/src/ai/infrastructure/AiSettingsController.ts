import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { aiConnectionSchema, updateAiSettingsSchema } from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";
import { AiSettingsUseCases } from "@/ai/application/AiSettingsUseCases.js";
import { AI_TYPES } from "@/ai/infrastructure/ioc/types.ai.js";

@injectable()
export class AiSettingsController {
  constructor(
    @inject(AI_TYPES.AiSettingsUseCases)
    private useCases: AiSettingsUseCases,
    @inject(USER_TYPES.IAuthorizationService)
    private authorization: IAuthorizationService,
  ) {}

  /** GET ai/settings */
  async get(): Promise<HttpResponseInit> {
    return ok(await this.useCases.get());
  }

  /** PUT ai/settings */
  async update(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updateAiSettingsSchema);
    const user = await this.authorization.currentUser();
    return ok(await this.useCases.update(user, body));
  }

  /** DELETE ai/settings — retour aux variables d'environnement. */
  async reset(): Promise<HttpResponseInit> {
    return ok(await this.useCases.reset());
  }

  /** POST ai/settings/models */
  async models(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, aiConnectionSchema);
    return ok(await this.useCases.listModels(body));
  }

  /** POST ai/settings/test */
  async test(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, aiConnectionSchema);
    return ok(await this.useCases.test(body));
  }
}
