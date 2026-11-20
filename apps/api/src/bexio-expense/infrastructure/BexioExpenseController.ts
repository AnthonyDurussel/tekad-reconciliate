import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { BexioExpenseIssueDTO, linkBexioExpenseSchema } from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { pathId, queryString } from "@/shared/infrastructure/http/query.js";
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

  async link(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, linkBexioExpenseSchema);
    return ok(await this.useCases.link(pathId(request), body.expenseId));
  }

  async unlink(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.unlink(pathId(request)));
  }
}
