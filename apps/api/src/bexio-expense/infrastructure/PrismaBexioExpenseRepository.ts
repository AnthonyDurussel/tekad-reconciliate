import { inject, injectable } from "inversify";
import type { Prisma, PrismaClient } from "@generated/prisma/client.js";
import { dateToDay, dayToDate } from "@/shared/domain/dates.js";
import { toNumber } from "@/shared/infrastructure/decimal.js";
import type {
  BexioExpenseFilter,
  IBexioExpenseRepository,
  StoredBexioExpense,
} from "@/bexio-expense/application/IBexioExpenseRepository.js";

type Row = Prisma.BexioExpenseDBGetPayload<object>;

const toStored = (r: Row): StoredBexioExpense => ({
  id: r.id,
  documentNo: r.document_no,
  title: r.title,
  vendor: r.vendor,
  status: r.status,
  paidOn: dateToDay(r.paid_on),
  gross: toNumber(r.gross) ?? 0,
  currency: r.currency,
  bookingAccountId: r.booking_account_id,
  bookingAccountNo: r.booking_account_no,
  bookingAccountName: r.booking_account_name,
  bankAccountId: r.bank_account_id,
  bankAccountNo: r.bank_account_no,
  bankAccountName: r.bank_account_name,
  paymentAccountId: r.payment_account_id,
  transactionId: r.transaction_id,
  attachmentIds: r.attachment_ids,
  syncedAt: r.synced_at,
});

@injectable()
export class PrismaBexioExpenseRepository implements IBexioExpenseRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async replaceAll(
    rows: Omit<StoredBexioExpense, "syncedAt" | "paymentAccountId">[],
  ): Promise<void> {
    const now = new Date();
    for (const r of rows) {
      const data = {
        document_no: r.documentNo,
        title: r.title,
        vendor: r.vendor,
        status: r.status,
        paid_on: dayToDate(r.paidOn),
        gross: r.gross,
        currency: r.currency,
        booking_account_id: r.bookingAccountId,
        booking_account_no: r.bookingAccountNo,
        booking_account_name: r.bookingAccountName,
        bank_account_id: r.bankAccountId,
        bank_account_no: r.bankAccountNo,
        bank_account_name: r.bankAccountName,
        transaction_id: r.transactionId,
        attachment_ids: r.attachmentIds,
        synced_at: now,
      };
      await this.prisma.bexioExpenseDB.upsert({
        where: { id: r.id },
        create: { id: r.id, ...data },
        update: data,
      });
    }
    await this.prisma.bexioExpenseDB.deleteMany({
      where: { id: { notIn: rows.map((r) => r.id) } },
    });
  }

  async list(f: BexioExpenseFilter): Promise<StoredBexioExpense[]> {
    const where: Prisma.BexioExpenseDBWhereInput = {};
    if (f.from || f.to) where.paid_on = { gte: f.from, lt: f.to };
    if (f.search) {
      where.OR = [
        { title: { contains: f.search, mode: "insensitive" } },
        { vendor: { contains: f.search, mode: "insensitive" } },
        { document_no: { contains: f.search, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.bexioExpenseDB.findMany({
      where,
      orderBy: [
        { paid_on: { sort: "desc", nulls: "first" } },
        { document_no: "desc" },
      ],
      take: 5000,
    });
    return rows.map(toStored);
  }

  async find(id: string) {
    const row = await this.prisma.bexioExpenseDB.findUnique({ where: { id } });
    return row ? toStored(row) : null;
  }

  async setPaymentAccount(
    id: string,
    paymentAccountId: string | null,
  ): Promise<void> {
    await this.prisma.bexioExpenseDB.update({
      where: { id },
      data: { payment_account_id: paymentAccountId },
    });
  }

  async setAttachments(id: string, attachmentIds: string[]): Promise<void> {
    await this.prisma.bexioExpenseDB.update({
      where: { id },
      data: { attachment_ids: attachmentIds },
    });
  }
}
