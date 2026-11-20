import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import type {
  CreateExpenseCategoryDTO,
  CreatePaymentAccountDTO,
  UpdateExpenseCategoryDTO,
  UpdatePaymentAccountDTO,
} from "@repo/models";
import { ConflictError, NotFoundError } from "@/shared/domain/errors.js";
import {
  createPaymentAccount,
  patchPaymentAccount,
  type PaymentAccountProps,
} from "@/settings/domain/PaymentAccount.js";
import {
  createExpenseCategory,
  patchExpenseCategory,
  type ExpenseCategoryProps,
} from "@/settings/domain/ExpenseCategory.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

/**
 * Comptes de paiement, cartes et types de dépense. Un élément déjà porté par
 * une pièce ne se supprime pas (409) : il se désactive.
 */
@injectable()
export class SettingsUseCases {
  constructor(
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private repository: ISettingsRepository,
  ) {}

  listPaymentAccounts() {
    return this.repository.listPaymentAccounts();
  }

  async createPaymentAccount(
    input: CreatePaymentAccountDTO,
  ): Promise<PaymentAccountProps> {
    const account = createPaymentAccount(randomUUID(), input, randomUUID);
    await this.repository.savePaymentAccount(account, true);
    return account;
  }

  async updatePaymentAccount(
    id: string,
    input: UpdatePaymentAccountDTO,
  ): Promise<PaymentAccountProps> {
    const current = await this.repository.findPaymentAccount(id);
    if (!current) throw new NotFoundError("Payment account");
    const account = patchPaymentAccount(current, input, randomUUID);
    await this.repository.savePaymentAccount(account, false);
    return account;
  }

  async deletePaymentAccount(id: string): Promise<void> {
    const accounts = await this.repository.listPaymentAccounts();
    const account = accounts.find((a) => a.id === id);
    if (!account) throw new NotFoundError("Payment account");
    if (account.expenseCount > 0) {
      throw new ConflictError(
        `${account.expenseCount} pièce(s) portent ce compte : désactivez-le plutôt`,
      );
    }
    await this.repository.deletePaymentAccount(id);
  }

  listCategories() {
    return this.repository.listCategories();
  }

  async createCategory(
    input: CreateExpenseCategoryDTO,
  ): Promise<ExpenseCategoryProps> {
    const category = createExpenseCategory(randomUUID(), input);
    await this.repository.saveCategory(category, true);
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateExpenseCategoryDTO,
  ): Promise<ExpenseCategoryProps> {
    const current = await this.repository.findCategory(id);
    if (!current) throw new NotFoundError("Expense category");
    const category = patchExpenseCategory(current, input);
    await this.repository.saveCategory(category, false);
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const categories = await this.repository.listCategories();
    const category = categories.find((c) => c.id === id);
    if (!category) throw new NotFoundError("Expense category");
    if (category.expenseCount > 0) {
      throw new ConflictError(
        `${category.expenseCount} pièce(s) portent ce type : désactivez-le plutôt`,
      );
    }
    await this.repository.deleteCategory(id);
  }
}
