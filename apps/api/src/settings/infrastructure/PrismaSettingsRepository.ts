import { inject, injectable } from "inversify";
import type { PrismaClient } from "@generated/prisma/client.js";
import { BookingModeDTO, PaymentAccountKindDTO } from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import { toNumber } from "@/shared/infrastructure/decimal.js";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import type {
  ISettingsRepository,
  WithUsage,
} from "@/settings/application/repositories/ISettingsRepository.js";

const accountInclude = {
  cards: { orderBy: { last4: "asc" } },
  _count: { select: { expenses: true } },
} as const;

type AccountRow = {
  id: string;
  kind: string;
  name: string;
  bexio_account_no: string | null;
  booking_mode: string;
  revolut_account_id: string | null;
  position: number;
  active: boolean;
  cards: {
    id: string;
    last4: string;
    label: string | null;
    holder: string | null;
    active: boolean;
  }[];
};

export const toPaymentAccount = (row: AccountRow): PaymentAccountProps => ({
  id: row.id,
  kind: row.kind as PaymentAccountKindDTO,
  name: row.name,
  bexioAccountNo: row.bexio_account_no,
  bookingMode: row.booking_mode as BookingModeDTO,
  revolutAccountId: row.revolut_account_id,
  position: row.position,
  active: row.active,
  cards: row.cards.map((c) => ({
    id: c.id,
    last4: c.last4,
    label: c.label,
    holder: c.holder,
    active: c.active,
  })),
});

type CategoryRow = {
  id: string;
  code: string;
  label: string;
  bexio_account_no: string;
  bexio_tax_id: number | null;
  vat_rate: unknown;
  keywords: string[];
  mcc_codes: string[];
  position: number;
  active: boolean;
};

export const toCategory = (row: CategoryRow): ExpenseCategoryProps => ({
  id: row.id,
  code: row.code,
  label: row.label,
  bexioAccountNo: row.bexio_account_no,
  bexioTaxId: row.bexio_tax_id,
  vatRate: toNumber(row.vat_rate),
  keywords: row.keywords,
  mccCodes: row.mcc_codes,
  position: row.position,
  active: row.active,
});

const uniqueViolation = (error: unknown) =>
  (error as { code?: string })?.code === "P2002";

@injectable()
export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async listPaymentAccounts(): Promise<WithUsage<PaymentAccountProps>[]> {
    const rows = await this.prisma.paymentAccountDB.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: accountInclude,
    });
    return rows.map((r) => ({
      ...toPaymentAccount(r),
      expenseCount: r._count.expenses,
    }));
  }

  async findPaymentAccount(id: string): Promise<PaymentAccountProps | null> {
    const row = await this.prisma.paymentAccountDB.findUnique({
      where: { id },
      include: accountInclude,
    });
    return row ? toPaymentAccount(row) : null;
  }

  async savePaymentAccount(
    account: PaymentAccountProps,
    isNew: boolean,
  ): Promise<void> {
    const data = {
      kind: account.kind,
      name: account.name,
      bexio_account_no: account.bexioAccountNo,
      booking_mode: account.bookingMode,
      revolut_account_id: account.revolutAccountId,
      position: account.position,
      active: account.active,
    };
    try {
      if (isNew) {
        await this.prisma.paymentAccountDB.create({
          data: { id: account.id, ...data },
        });
      } else {
        await this.prisma.paymentAccountDB.update({
          where: { id: account.id },
          data,
        });
        await this.prisma.paymentCardDB.deleteMany({
          where: { account_id: account.id },
        });
      }
      if (account.cards.length) {
        await this.prisma.paymentCardDB.createMany({
          data: account.cards.map((c) => ({
            id: c.id,
            account_id: account.id,
            last4: c.last4,
            label: c.label,
            holder: c.holder,
            active: c.active,
          })),
        });
      }
    } catch (error) {
      if (uniqueViolation(error)) {
        throw new ConflictError(
          "ce nom, cette carte ou ce compte Revolut est déjà utilisé",
        );
      }
      throw error;
    }
  }

  async deletePaymentAccount(id: string): Promise<void> {
    await this.prisma.paymentAccountDB.delete({ where: { id } });
  }

  async listCategories(): Promise<WithUsage<ExpenseCategoryProps>[]> {
    const rows = await this.prisma.expenseCategoryDB.findMany({
      orderBy: [{ position: "asc" }, { label: "asc" }],
      include: { _count: { select: { expenses: true } } },
    });
    return rows.map((r) => ({
      ...toCategory(r),
      expenseCount: r._count.expenses,
    }));
  }

  async findCategory(id: string): Promise<ExpenseCategoryProps | null> {
    const row = await this.prisma.expenseCategoryDB.findUnique({
      where: { id },
    });
    return row ? toCategory(row) : null;
  }

  async saveCategory(
    category: ExpenseCategoryProps,
    isNew: boolean,
  ): Promise<void> {
    const data = {
      code: category.code,
      label: category.label,
      bexio_account_no: category.bexioAccountNo,
      bexio_tax_id: category.bexioTaxId,
      vat_rate: category.vatRate,
      keywords: category.keywords,
      mcc_codes: category.mccCodes,
      position: category.position,
      active: category.active,
    };
    try {
      if (isNew) {
        await this.prisma.expenseCategoryDB.create({
          data: { id: category.id, ...data },
        });
      } else {
        await this.prisma.expenseCategoryDB.update({
          where: { id: category.id },
          data,
        });
      }
    } catch (error) {
      if (uniqueViolation(error)) {
        throw new ConflictError(`le code ${category.code} existe déjà`);
      }
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.expenseCategoryDB.delete({ where: { id } });
  }
}
