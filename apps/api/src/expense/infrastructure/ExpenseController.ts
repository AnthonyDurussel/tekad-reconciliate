import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  ExpenseIssueDTO,
  ExpenseStatusDTO,
  createExpenseFromBexioSchema,
  createExpenseFromTransactionSchema,
  ignoreSchema,
  linkExpenseBexioSchema,
  linkReceiptSchema,
  matchExpenseSchema,
  updateExpenseSchema,
  type MatchCandidateDTO,
} from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import {
  pathId,
  queryEnum,
  queryString,
} from "@/shared/infrastructure/http/query.js";
import { queryDay } from "@/shared/infrastructure/http/period.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { fileResponse } from "@/shared/infrastructure/http/fileResponse.js";
import { xlsxResponse } from "@/shared/infrastructure/excel/workbook.js";
import { ValidationError } from "@/shared/domain/errors.js";
import { dayToDate, todayIso } from "@/shared/domain/dates.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";
import { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import type { ExpenseFilter } from "@/expense/application/repositories/IExpenseRepository.js";
import { ExpenseMapper } from "@/expense/infrastructure/ExpenseMapper.js";
import { expenseWorkbook } from "@/expense/infrastructure/expenseWorkbook.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import { RevolutMapper } from "@/revolut/infrastructure/RevolutMapper.js";
import { dayAfter } from "@/revolut/infrastructure/RevolutController.js";

const UUID = /^[0-9a-f-]{36}$/i;

function idOrNone(request: HttpRequest, name: string): string | undefined {
  const value = queryString(request, name);
  if (value && value !== "none" && !UUID.test(value)) {
    throw new ValidationError(`query: ${name} invalide`);
  }
  return value;
}

const ISSUES: readonly string[] = [...Object.values(ExpenseIssueDTO), "ok"];

function filterOf(
  request: HttpRequest,
): ExpenseFilter & { issue?: ExpenseIssueDTO | "ok" } {
  const issue = queryString(request, "issue");
  if (issue && !ISSUES.includes(issue)) {
    throw new ValidationError("query: issue invalide");
  }
  return {
    issue: issue as ExpenseIssueDTO | "ok" | undefined,
    from: dayToDate(queryDay(request, "from")) ?? undefined,
    to: dayAfter(queryDay(request, "to")),
    paymentAccountId: idOrNone(request, "paymentAccountId"),
    categoryId: idOrNone(request, "categoryId"),
    status: queryEnum(request, "status", ExpenseStatusDTO),
    search: queryString(request, "search"),
  };
}

@injectable()
export class ExpenseController {
  constructor(
    @inject(EXPENSE_TYPES.ExpenseUseCases) private useCases: ExpenseUseCases,
    @inject(USER_TYPES.IAuthorizationService)
    private authorization: IAuthorizationService,
  ) {}

  async list(request: HttpRequest): Promise<HttpResponseInit> {
    const views = await this.useCases.list(filterOf(request));
    return ok(views.map((v) => ExpenseMapper.toDTO(v, false)));
  }

  async export(request: HttpRequest): Promise<HttpResponseInit> {
    const views = await this.useCases.list(filterOf(request));
    return xlsxResponse(
      expenseWorkbook(views.map((v) => ExpenseMapper.toDTO(v, false))),
      `depenses-${todayIso()}.xlsx`,
    );
  }

  async get(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(ExpenseMapper.toDTO(await this.useCases.get(pathId(request))));
  }

  async file(request: HttpRequest): Promise<HttpResponseInit> {
    return fileResponse(await this.useCases.file(pathId(request)));
  }

  async receiptFile(request: HttpRequest): Promise<HttpResponseInit> {
    return fileResponse(await this.useCases.receiptFileById(pathId(request)));
  }

  async receiptCandidates(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.receiptCandidates(pathId(request)));
  }

  async bexioCandidates(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(await this.useCases.bexioCandidates(pathId(request)));
  }

  async createFromTransaction(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, createExpenseFromTransactionSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.createFromTransaction(body.transactionId),
      ),
    );
  }

  async createFromBexio(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, createExpenseFromBexioSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.createFromBexio(body.bexioExpenseId),
      ),
    );
  }

  async linkReceipt(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, linkReceiptSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.linkReceipt(pathId(request), body.receiptId),
      ),
    );
  }

  async unlinkReceipt(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      ExpenseMapper.toDTO(await this.useCases.unlinkReceipt(pathId(request))),
    );
  }

  async linkBexio(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, linkExpenseBexioSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.linkBexio(pathId(request), body.bexioExpenseId),
      ),
    );
  }

  async unlinkBexio(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      ExpenseMapper.toDTO(await this.useCases.unlinkBexio(pathId(request))),
    );
  }

  async candidates(request: HttpRequest): Promise<HttpResponseInit> {
    const list = await this.useCases.candidates(pathId(request));
    return ok(
      list.map((c): MatchCandidateDTO => ({
        transaction: RevolutMapper.toDTO(c.transaction),
        score: c.score,
        reasons: c.reasons,
      })),
    );
  }

  async update(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updateExpenseSchema);
    return ok(
      ExpenseMapper.toDTO(await this.useCases.update(pathId(request), body)),
    );
  }

  async extract(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      ExpenseMapper.toDTO(await this.useCases.extract(pathId(request))),
    );
  }

  async match(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, matchExpenseSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.match(pathId(request), body.transactionId),
      ),
    );
  }

  async ignore(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, ignoreSchema);
    return ok(
      ExpenseMapper.toDTO(
        await this.useCases.ignore(pathId(request), body.reason ?? null),
      ),
    );
  }

  async restore(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      ExpenseMapper.toDTO(await this.useCases.restore(pathId(request))),
    );
  }

  async book(request: HttpRequest): Promise<HttpResponseInit> {
    const user = await this.authorization.currentUser();
    return ok(
      ExpenseMapper.toDTO(await this.useCases.book(pathId(request), user.id)),
    );
  }

  async unbook(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(ExpenseMapper.toDTO(await this.useCases.unbook(pathId(request))));
  }
}
