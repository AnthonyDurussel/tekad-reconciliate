import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";

export type WithUsage<T> = T & { expenseCount: number };

/** Port de persistance du paramétrage. */
export interface ISettingsRepository {
  listPaymentAccounts(): Promise<WithUsage<PaymentAccountProps>[]>;
  findPaymentAccount(id: string): Promise<PaymentAccountProps | null>;
  /** `ConflictError` si le nom, la carte ou le compte Revolut existe déjà. */
  savePaymentAccount(
    account: PaymentAccountProps,
    isNew: boolean,
  ): Promise<void>;
  deletePaymentAccount(id: string): Promise<void>;

  listCategories(): Promise<WithUsage<ExpenseCategoryProps>[]>;
  findCategory(id: string): Promise<ExpenseCategoryProps | null>;
  /** `ConflictError` si le code existe déjà. */
  saveCategory(category: ExpenseCategoryProps, isNew: boolean): Promise<void>;
  deleteCategory(id: string): Promise<void>;
}
