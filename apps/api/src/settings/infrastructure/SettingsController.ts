import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  createExpenseCategorySchema,
  createPaymentAccountSchema,
  updateExpenseCategorySchema,
  updatePaymentAccountSchema,
  type ExpenseCategoryDTO,
  type PaymentAccountDTO,
} from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { pathId } from "@/shared/infrastructure/http/query.js";
import {
  created,
  noContent,
  ok,
} from "@/shared/infrastructure/http/responses.js";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import { SettingsUseCases } from "@/settings/application/usecases/SettingsUseCases.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

export const paymentAccountDTO = (
  a: PaymentAccountProps & { expenseCount?: number },
): PaymentAccountDTO => ({
  id: a.id,
  kind: a.kind,
  name: a.name,
  bexioAccountNo: a.bexioAccountNo,
  bexioBankAccountId: a.bexioBankAccountId,
  reconciliation: a.reconciliation,
  statementFormat: a.statementFormat,
  bookingMode: a.bookingMode,
  revolutAccountId: a.revolutAccountId,
  position: a.position,
  active: a.active,
  cards: a.cards.map((c) => ({ ...c })),
  expenseCount: a.expenseCount,
});

export const categoryDTO = (
  c: ExpenseCategoryProps & { expenseCount?: number },
): ExpenseCategoryDTO => ({ ...c });

@injectable()
export class SettingsController {
  constructor(
    @inject(SETTINGS_TYPES.SettingsUseCases) private useCases: SettingsUseCases,
  ) {}

  async listPaymentAccounts(): Promise<HttpResponseInit> {
    return ok(
      (await this.useCases.listPaymentAccounts()).map(paymentAccountDTO),
    );
  }

  async createPaymentAccount(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, createPaymentAccountSchema);
    return created(
      paymentAccountDTO(await this.useCases.createPaymentAccount(body)),
    );
  }

  async updatePaymentAccount(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updatePaymentAccountSchema);
    return ok(
      paymentAccountDTO(
        await this.useCases.updatePaymentAccount(pathId(request), body),
      ),
    );
  }

  async deletePaymentAccount(request: HttpRequest): Promise<HttpResponseInit> {
    await this.useCases.deletePaymentAccount(pathId(request));
    return noContent();
  }

  async listCategories(): Promise<HttpResponseInit> {
    return ok((await this.useCases.listCategories()).map(categoryDTO));
  }

  async createCategory(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, createExpenseCategorySchema);
    return created(categoryDTO(await this.useCases.createCategory(body)));
  }

  async updateCategory(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, updateExpenseCategorySchema);
    return ok(
      categoryDTO(await this.useCases.updateCategory(pathId(request), body)),
    );
  }

  /** POST expense-categories/sync-bexio */
  async syncCategories(): Promise<HttpResponseInit> {
    return ok(await this.useCases.syncCategoriesFromBexio());
  }

  /** GET bexio/accounts */
  async bexioAccounts(): Promise<HttpResponseInit> {
    return ok(await this.useCases.bexioAccounts());
  }

  /** GET bexio/taxes */
  async bexioTaxes(): Promise<HttpResponseInit> {
    return ok(await this.useCases.bexioTaxes());
  }

  async deleteCategory(request: HttpRequest): Promise<HttpResponseInit> {
    await this.useCases.deleteCategory(pathId(request));
    return noContent();
  }
}
