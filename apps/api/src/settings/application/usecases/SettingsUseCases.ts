import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import {
  BexioAccountTypeDTO,
  type BexioAccountDTO,
  type BexioTaxDTO,
  type CategorySyncResultDTO,
  type CreateExpenseCategoryDTO,
  CreatePaymentAccountDTO,
  UpdateExpenseCategoryDTO,
  UpdatePaymentAccountDTO,
} from "@repo/models";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/shared/domain/errors.js";
import {
  createPaymentAccount,
  patchPaymentAccount,
  type PaymentAccountProps,
} from "@/settings/domain/PaymentAccount.js";
import {
  createExpenseCategory,
  DEFAULT_RULES_BY_ACCOUNT,
  patchExpenseCategory,
  type ExpenseCategoryProps,
} from "@/settings/domain/ExpenseCategory.js";
import type { IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";
import { BEXIO_TYPES } from "@/bexio/infrastructure/ioc/types.bexio.js";
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
    @inject(BEXIO_TYPES.IBexioGateway) private bexio: IBexioGateway,
  ) {}

  private chart: Promise<BexioAccountDTO[]> | null = null;

  /** Le plan comptable bexio (lu une fois par requête). */
  bexioAccounts(): Promise<BexioAccountDTO[]> {
    this.chart ??= this.bexio.listAccounts();
    return this.chart;
  }

  bexioTaxes() {
    return this.bexio.listTaxes();
  }

  /**
   * Avec bexio configuré, un numéro de compte doit exister dans son plan
   * comptable (et être du bon genre) ; sans bexio, il est pris tel quel.
   */
  private async checkAccount(
    accountNo: string | null | undefined,
    types: BexioAccountTypeDTO[],
    what: string,
  ): Promise<BexioAccountDTO | null> {
    if (!accountNo || !this.bexio.configured) return null;
    const account = (await this.bexioAccounts()).find(
      (a) => a.accountNo === accountNo,
    );
    if (!account) {
      throw new ValidationError(
        `le compte ${accountNo} n'existe pas dans le plan comptable bexio`,
      );
    }
    if (!types.includes(account.type)) {
      throw new ValidationError(
        `le compte ${accountNo} (${account.name}) n'est pas ${what}`,
      );
    }
    return account;
  }

  private checkPaymentAccountNo(accountNo: string | null | undefined) {
    return this.checkAccount(
      accountNo,
      [BexioAccountTypeDTO.ASSET, BexioAccountTypeDTO.LIABILITY],
      "un compte de trésorerie ou de passif",
    );
  }

  private checkExpenseAccountNo(accountNo: string | null | undefined) {
    return this.checkAccount(
      accountNo,
      [BexioAccountTypeDTO.EXPENSE],
      "un compte de charge",
    );
  }

  /**
   * Reprend les comptes de charge actifs du plan comptable bexio : un type
   * de dépense par compte (code = numéro, libellé = nom, code TVA du compte),
   * créé avec des règles de reconnaissance par défaut quand le numéro en a ;
   * un type existant garde ses règles et son code TVA s'il en a un. Un type
   * dont le compte a disparu (ou est inactif) dans bexio est désactivé.
   */
  async syncCategoriesFromBexio(): Promise<CategorySyncResultDTO> {
    if (!this.bexio.configured) {
      throw new ConflictError("bexio n'est pas configuré (BEXIO_API_TOKEN)");
    }
    const expenseAccounts = (await this.bexioAccounts()).filter(
      (a) => a.type === BexioAccountTypeDTO.EXPENSE && a.active,
    );
    const taxList: BexioTaxDTO[] = await this.bexio.listTaxes().catch(() => []);
    const taxes = new Map(taxList.map((t) => [t.id, t]));
    const categories = await this.repository.listCategories();
    const result: CategorySyncResultDTO = {
      accounts: expenseAccounts.length,
      created: 0,
      updated: 0,
      deactivated: 0,
    };
    const seen = new Set<string>();
    for (const [position, account] of expenseAccounts.entries()) {
      const current =
        categories.find((c) => c.bexioAccountId === account.id) ??
        categories.find(
          (c) => !c.bexioAccountId && c.code === account.accountNo,
        );
      const tax = account.taxId ? taxes.get(account.taxId) : undefined;
      if (current) {
        seen.add(current.id);
        const next = patchExpenseCategory(current, {
          bexioAccountId: account.id,
          code: account.accountNo,
          label: account.name,
          bexioAccountNo: account.accountNo,
          bexioTaxId: current.bexioTaxId ?? account.taxId,
          vatRate: current.vatRate ?? tax?.rate ?? null,
        });
        const fields = [
          "bexioAccountId",
          "code",
          "label",
          "bexioAccountNo",
          "bexioTaxId",
          "vatRate",
        ] as const;
        if (fields.some((f) => next[f] !== current[f])) {
          await this.repository.saveCategory(next, false);
          result.updated++;
        }
      } else {
        const rules = DEFAULT_RULES_BY_ACCOUNT[account.accountNo];
        await this.repository.saveCategory(
          createExpenseCategory(randomUUID(), {
            bexioAccountId: account.id,
            code: account.accountNo,
            label: account.name,
            bexioAccountNo: account.accountNo,
            bexioTaxId: account.taxId,
            vatRate: tax?.rate ?? null,
            keywords: rules?.keywords ?? [],
            mccCodes: rules?.mccCodes ?? [],
            position,
          }),
          true,
        );
        result.created++;
      }
    }
    for (const c of categories) {
      if (c.bexioAccountId && !seen.has(c.id) && c.active) {
        const { expenseCount: _count, ...plain } = c;
        await this.repository.saveCategory({ ...plain, active: false }, false);
        result.deactivated++;
      }
    }
    return result;
  }

  listPaymentAccounts() {
    return this.repository.listPaymentAccounts();
  }

  async createPaymentAccount(
    input: CreatePaymentAccountDTO,
  ): Promise<PaymentAccountProps> {
    const account = createPaymentAccount(randomUUID(), input, randomUUID);
    await this.checkPaymentAccountNo(account.bexioAccountNo);
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
    if (account.bexioAccountNo !== current.bexioAccountNo) {
      await this.checkPaymentAccountNo(account.bexioAccountNo);
    }
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
    const bexioAccount = await this.checkExpenseAccountNo(input.bexioAccountNo);
    const category = createExpenseCategory(randomUUID(), {
      ...input,
      bexioAccountId: bexioAccount?.id ?? input.bexioAccountId ?? null,
    });
    await this.repository.saveCategory(category, true);
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateExpenseCategoryDTO,
  ): Promise<ExpenseCategoryProps> {
    const current = await this.repository.findCategory(id);
    if (!current) throw new NotFoundError("Expense category");
    let category = patchExpenseCategory(current, input);
    if (category.bexioAccountNo !== current.bexioAccountNo) {
      const bexioAccount = await this.checkExpenseAccountNo(
        category.bexioAccountNo,
      );
      category = { ...category, bexioAccountId: bexioAccount?.id ?? null };
    }
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
