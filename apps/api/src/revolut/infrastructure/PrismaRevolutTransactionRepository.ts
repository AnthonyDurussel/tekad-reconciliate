import { inject, injectable } from "inversify";
import type { Prisma, PrismaClient } from "@generated/prisma/client.js";
import { toNumber } from "@/shared/infrastructure/decimal.js";
import type {
  RevolutTransactionImport,
  RevolutTransactionProps,
} from "@/revolut/domain/RevolutTransaction.js";
import type {
  IRevolutTransactionRepository,
  RevolutTransactionFilter,
} from "@/revolut/application/repositories/IRevolutTransactionRepository.js";

type Row = Prisma.RevolutTransactionDBGetPayload<object>;

export const toTransaction = (row: Row): RevolutTransactionProps => ({
  id: row.id,
  revolutId: row.revolut_id,
  legId: row.leg_id,
  revolutAccountId: row.revolut_account_id,
  paymentAccountId: row.payment_account_id,
  type: row.type,
  state: row.state,
  occurredAt: row.occurred_at,
  description: row.description,
  merchantName: row.merchant_name,
  merchantCity: row.merchant_city,
  merchantCountry: row.merchant_country,
  mcc: row.mcc,
  amount: toNumber(row.amount) ?? 0,
  currency: row.currency,
  billAmount: toNumber(row.bill_amount),
  billCurrency: row.bill_currency,
  cardLast4: row.card_last4,
  requiresReceipt: row.requires_receipt,
  expenseId: row.expense_id,
  ignored: row.ignored,
  ignoreReason: row.ignore_reason,
});

const MISSING: Prisma.RevolutTransactionDBWhereInput = {
  requires_receipt: true,
  ignored: false,
  expense_id: null,
};

@injectable()
export class PrismaRevolutTransactionRepository implements IRevolutTransactionRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async list(f: RevolutTransactionFilter): Promise<RevolutTransactionProps[]> {
    const where: Prisma.RevolutTransactionDBWhereInput = {
      occurred_at: { gte: f.from, lt: f.to },
    };
    if (f.filter === "missing") Object.assign(where, MISSING);
    if (f.filter === "matched") where.expense_id = { not: null };
    if (f.filter === "ignored") where.ignored = true;
    if (f.search) {
      where.OR = [
        { merchant_name: { contains: f.search, mode: "insensitive" } },
        { description: { contains: f.search, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.revolutTransactionDB.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      take: 5000,
    });
    return rows.map(toTransaction);
  }

  async findById(id: string) {
    const row = await this.prisma.revolutTransactionDB.findUnique({
      where: { id },
    });
    return row ? toTransaction(row) : null;
  }

  async findByExpense(expenseId: string) {
    const row = await this.prisma.revolutTransactionDB.findUnique({
      where: { expense_id: expenseId },
    });
    return row ? toTransaction(row) : null;
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.revolutTransactionDB.findMany({
      where: { id: { in: ids } },
    });
    return rows.map(toTransaction);
  }

  async upsertMany(rows: RevolutTransactionImport[]): Promise<number> {
    let created = 0;
    for (const r of rows) {
      const data = {
        revolut_account_id: r.revolutAccountId,
        type: r.type,
        state: r.state,
        occurred_at: r.occurredAt,
        description: r.description,
        merchant_name: r.merchantName,
        merchant_city: r.merchantCity,
        merchant_country: r.merchantCountry,
        mcc: r.mcc,
        amount: r.amount,
        currency: r.currency,
        bill_amount: r.billAmount,
        bill_currency: r.billCurrency,
        card_last4: r.cardLast4,
        requires_receipt: r.requiresReceipt,
        raw: r.raw as Prisma.InputJsonValue,
      };
      const existing = await this.prisma.revolutTransactionDB.findUnique({
        where: {
          revolut_id_leg_id: { revolut_id: r.revolutId, leg_id: r.legId },
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.revolutTransactionDB.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.revolutTransactionDB.create({
          data: { revolut_id: r.revolutId, leg_id: r.legId, ...data },
        });
        created++;
      }
    }
    return created;
  }

  async linkPaymentAccounts(map: Map<string, string>): Promise<void> {
    for (const [revolutAccountId, paymentAccountId] of map) {
      await this.prisma.revolutTransactionDB.updateMany({
        where: { revolut_account_id: revolutAccountId },
        data: { payment_account_id: paymentAccountId },
      });
    }
  }

  async listUnmatched(from: Date, to: Date) {
    const rows = await this.prisma.revolutTransactionDB.findMany({
      where: { ...MISSING, occurred_at: { gte: from, lt: to } },
    });
    return rows.map(toTransaction);
  }

  async setExpense(id: string, expenseId: string | null): Promise<void> {
    await this.prisma.revolutTransactionDB.update({
      where: { id },
      data: { expense_id: expenseId },
    });
  }

  async clearExpense(expenseId: string): Promise<void> {
    await this.prisma.revolutTransactionDB.updateMany({
      where: { expense_id: expenseId },
      data: { expense_id: null },
    });
  }

  async setIgnored(id: string, ignored: boolean, reason: string | null) {
    await this.prisma.revolutTransactionDB.update({
      where: { id },
      data: { ignored, ignore_reason: ignored ? reason : null },
    });
  }

  async latestOccurredAt(): Promise<Date | null> {
    const row = await this.prisma.revolutTransactionDB.findFirst({
      orderBy: { occurred_at: "desc" },
      select: { occurred_at: true },
    });
    return row?.occurred_at ?? null;
  }
}
