import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  BexioExpenseIssueDTO,
  linkBexioExpenseSchema,
  setBexioExpenseAccountSchema,
} from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import {
  pathId,
  pathParam,
  queryString,
} from "@/shared/infrastructure/http/query.js";
import { queryDay } from "@/shared/infrastructure/http/period.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { ValidationError } from "@/shared/domain/errors.js";
import { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

const ISSUES = [...Object.values(BexioExpenseIssueDTO), "ok"] as const;

@injectable()
export class BexioExpenseController {
  constructor(
    @inject(BEXIO_EXPENSE_TYPES.BexioExpenseUseCases)
    private useCases: BexioExpenseUseCases,
  ) {}

  async list(request: HttpRequest): Promise<HttpResponseInit> {
    const issue = queryString(request, "issue");
    if (issue && !(ISSUES as readonly string[]).includes(issue)) {
      throw new ValidationError("query: issue invalide");
    }
    const paymentAccountId = queryString(request, "paymentAccountId");
    return ok(
      await this.useCases.list({
        from: queryDay(request, "from"),
        to: queryDay(request, "to"),
        paymentAccountId,
        issue: issue as (typeof ISSUES)[number] | undefined,
        search: queryString(request, "search"),
      }),
    );
  }

  async get(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.get(pathId(request)));
  }

  async file(request: HttpRequest): Promise<HttpResponseInit> {
    const uuid = pathParam(request, "uuid");
    if (!/^[0-9a-f-]{36}$/i.test(uuid))
      throw new ValidationError("uuid invalide");
    const file = await this.useCases.file(pathId(request), uuid);
    const name = file.fileName.replace(/["\r\n]/g, "");
    return {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
      body: new Uint8Array(file.data),
    };
  }

  async setPaymentAccount(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, setBexioExpenseAccountSchema);
    return ok(
      await this.useCases.setPaymentAccount(
        pathId(request),
        body.paymentAccountId,
        body.applyToAccount ?? false,
      ),
    );
  }

  async link(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, linkBexioExpenseSchema);
    return ok(await this.useCases.link(pathId(request), body.expenseId));
  }

  async unlink(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.unlink(pathId(request)));
  }
}
