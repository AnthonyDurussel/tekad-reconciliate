import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { revolutSyncSchema } from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";
import { SyncUseCases } from "@/sync/application/usecases/SyncUseCases.js";
import { SYNC_TYPES } from "@/sync/infrastructure/ioc/types.sync.js";

@injectable()
export class SyncController {
  constructor(
    @inject(SYNC_TYPES.SyncUseCases) private useCases: SyncUseCases,
    @inject(USER_TYPES.IAuthorizationService)
    private authorization: IAuthorizationService,
  ) {}

  private async userId() {
    return (await this.authorization.currentUser()).id;
  }

  async status(): Promise<HttpResponseInit> {
    return ok(await this.useCases.status());
  }

  async runs(): Promise<HttpResponseInit> {
    return ok(await this.useCases.history());
  }

  async bexioInbox(): Promise<HttpResponseInit> {
    return ok(await this.useCases.bexioInbox(await this.userId()));
  }

  async extract(): Promise<HttpResponseInit> {
    return ok(await this.useCases.extract(await this.userId()));
  }

  async revolut(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, revolutSyncSchema);
    return ok(
      await this.useCases.revolutSync(await this.userId(), body.from, body.to),
    );
  }

  async match(): Promise<HttpResponseInit> {
    return ok(await this.useCases.match(await this.userId()));
  }

  async all(): Promise<HttpResponseInit> {
    return ok(await this.useCases.all(await this.userId()));
  }
}
