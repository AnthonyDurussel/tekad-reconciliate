import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  pathId,
  queryBoolean,
  queryString,
} from "@/shared/infrastructure/http/query.js";
import { queryDay } from "@/shared/infrastructure/http/period.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { fileResponse } from "@/shared/infrastructure/http/fileResponse.js";
import { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

@injectable()
export class BexioExpenseController {
  constructor(
    @inject(BEXIO_EXPENSE_TYPES.BexioExpenseUseCases)
    private useCases: BexioExpenseUseCases,
  ) {}

  async list(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      await this.useCases.list({
        from: queryDay(request, "from"),
        to: queryDay(request, "to"),
        search: queryString(request, "search"),
        unlinked: queryBoolean(request, "unlinked"),
      }),
    );
  }

  async get(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.get(pathId(request)));
  }

  async file(request: HttpRequest): Promise<HttpResponseInit> {
    const file = await this.useCases.file(
      pathId(request),
      pathId(request, "uuid"),
    );
    return fileResponse(file);
  }
}
