import { inject, injectable } from "inversify";
import type { Prisma, PrismaClient } from "@generated/prisma/client.js";
import type {
  ExpenseSourceDTO,
  ExpenseStatusDTO,
  ExtractionDTO,
  SuggestionSourceDTO,
} from "@repo/models";
import { dateToDay, dayToDate } from "@/shared/domain/dates.js";
import { toNumber } from "@/shared/infrastructure/decimal.js";
import { Expense, type ReceiptProps } from "@/expense/domain/Expense.js";
import type {
  ExpenseFilter,
  IExpenseRepository,
} from "@/expense/application/repositories/IExpenseRepository.js";

const include = {
  transaction: { select: { id: true } },
  receipt: true,
} as const;
type Row = Prisma.ExpenseDBGetPayload<{ include: typeof include }>;
type ReceiptRow = Prisma.ReceiptDBGetPayload<object>;

const toReceipt = (r: ReceiptRow): ReceiptProps => ({
  id: r.id,
  bexioFileId: r.bexio_file_id,
  bexioFileUuid: r.bexio_file_uuid,
  fileName: r.file_name,
  mimeType: r.mime_type,
  importedAt: r.imported_at,
  extraction: (r.extraction as unknown as ExtractionDTO | null) ?? null,
  extractedAt: r.extracted_at,
});

const receiptData = (r: ReceiptProps) => ({
  bexio_file_id: r.bexioFileId,
  bexio_file_uuid: r.bexioFileUuid,
  file_name: r.fileName,
  mime_type: r.mimeType,
  imported_at: r.importedAt,
  extraction: (r.extraction ?? undefined) as unknown as
    Prisma.InputJsonValue | undefined,
  extracted_at: r.extractedAt,
});

const toDomain = (r: Row): Expense =>
  Expense.restore({
    id: r.id,
    status: r.status as ExpenseStatusDTO,
    source: r.source as ExpenseSourceDTO,
    createdAt: r.created_at,
    receipt: r.receipt ? toReceipt(r.receipt) : null,
    date: dateToDay(r.date),
    merchant: r.merchant,
    description: r.description,
    totalAmount: toNumber(r.total_amount),
    currency: r.currency,
    vatAmount: toNumber(r.vat_amount),
    vatRate: toNumber(r.vat_rate),
    cardLast4: r.card_last4,
    paymentMethod: r.payment_method,
    extractedAt: r.extracted_at,
    manualFields: r.manual_fields,
    paymentAccountId: r.payment_account_id,
    paymentAccountSource:
      r.payment_account_source as SuggestionSourceDTO | null,
    categoryId: r.category_id,
    categorySource: r.category_source as SuggestionSourceDTO | null,
    debitAccountNo: r.debit_account_no,
    creditAccountNo: r.credit_account_no,
    bexioTaxId: r.bexio_tax_id,
    transactionId: r.transaction?.id ?? null,
    bexioEntryId: r.bexio_entry_id,
    bexioExpenseId: r.bexio_expense_id,
    bookedAt: r.booked_at,
    bookedById: r.booked_by_id,
    note: r.note,
    ignoreReason: r.ignore_reason,
  });

const toData = (e: Expense) => {
  const p = e.snapshot;
  return {
    status: p.status,
    source: p.source,
    created_at: p.createdAt,
    date: dayToDate(p.date),
    merchant: p.merchant,
    description: p.description,
    total_amount: p.totalAmount,
    currency: p.currency,
    vat_amount: p.vatAmount,
    vat_rate: p.vatRate,
    card_last4: p.cardLast4,
    payment_method: p.paymentMethod,
    extracted_at: p.extractedAt,
    manual_fields: p.manualFields,
    payment_account_id: p.paymentAccountId,
    payment_account_source: p.paymentAccountSource,
    category_id: p.categoryId,
    category_source: p.categorySource,
    debit_account_no: p.debitAccountNo,
    credit_account_no: p.creditAccountNo,
    bexio_tax_id: p.bexioTaxId,
    bexio_entry_id: p.bexioEntryId,
    bexio_expense_id: p.bexioExpenseId,
    booked_at: p.bookedAt,
    booked_by_id: p.bookedById,
    note: p.note,
    ignore_reason: p.ignoreReason,
  };
};

@injectable()
export class PrismaExpenseRepository implements IExpenseRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async list(f: ExpenseFilter): Promise<Expense[]> {
    const where: Prisma.ExpenseDBWhereInput = {};
    if (f.from || f.to) {
      // Une pièce non lue (sans date) reste visible : on la cherche par import.
      where.OR = [
        { date: { gte: f.from, lt: f.to } },
        { date: null, created_at: { gte: f.from, lt: f.to } },
      ];
    }
    if (f.paymentAccountId) {
      where.payment_account_id =
        f.paymentAccountId === "none" ? null : f.paymentAccountId;
    }
    if (f.categoryId) {
      where.category_id = f.categoryId === "none" ? null : f.categoryId;
    }
    if (f.status) where.status = f.status;
    if (f.search) {
      where.AND = [
        {
          OR: [
            { merchant: { contains: f.search, mode: "insensitive" } },
            { description: { contains: f.search, mode: "insensitive" } },
            {
              receipt: {
                file_name: { contains: f.search, mode: "insensitive" },
              },
            },
            { note: { contains: f.search, mode: "insensitive" } },
          ],
        },
      ];
    }
    const rows = await this.prisma.expenseDB.findMany({
      where,
      include,
      orderBy: [
        { date: { sort: "desc", nulls: "first" } },
        { created_at: "desc" },
      ],
      take: 5000,
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Expense | null> {
    const row = await this.prisma.expenseDB.findUnique({
      where: { id },
      include,
    });
    return row ? toDomain(row) : null;
  }

  async existingFileIds(fileIds: string[]): Promise<Set<string>> {
    const rows = await this.prisma.receiptDB.findMany({
      where: { bexio_file_id: { in: fileIds } },
      select: { bexio_file_id: true },
    });
    return new Set(rows.map((r) => r.bexio_file_id));
  }

  async setMissingFileUuids(uuids: Map<string, string>): Promise<void> {
    for (const [fileId, uuid] of uuids) {
      await this.prisma.receiptDB.updateMany({
        where: { bexio_file_id: fileId, bexio_file_uuid: null },
        data: { bexio_file_uuid: uuid },
      });
    }
  }

  async findByFileUuids(uuids: string[]): Promise<Expense[]> {
    if (!uuids.length) return [];
    const rows = await this.prisma.expenseDB.findMany({
      where: { receipt: { bexio_file_uuid: { in: uuids } } },
      include,
    });
    return rows.map(toDomain);
  }

  async findByTransactionId(transactionId: string): Promise<Expense | null> {
    const row = await this.prisma.expenseDB.findFirst({
      where: { transaction: { id: transactionId } },
      include,
    });
    return row ? toDomain(row) : null;
  }

  async findByBexioExpenseIds(ids: string[]): Promise<Expense[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.expenseDB.findMany({
      where: { bexio_expense_id: { in: ids } },
      include,
    });
    return rows.map(toDomain);
  }

  async listByStatus(statuses: ExpenseStatusDTO[], limit?: number) {
    const rows = await this.prisma.expenseDB.findMany({
      where: { status: { in: statuses } },
      include,
      orderBy: { created_at: "asc" },
      take: limit,
    });
    return rows.map(toDomain);
  }

  /** La pièce rattachée : créée ou mise à jour avec la dépense. */
  private async saveReceipt(expense: Expense): Promise<string | null> {
    const receipt = expense.receipt;
    if (!receipt) return null;
    await this.prisma.receiptDB.upsert({
      where: { id: receipt.id },
      create: { id: receipt.id, ...receiptData(receipt) },
      update: receiptData(receipt),
    });
    return receipt.id;
  }

  async create(expense: Expense): Promise<void> {
    const receiptId = await this.saveReceipt(expense);
    await this.prisma.expenseDB.create({
      data: { id: expense.id, ...toData(expense), receipt_id: receiptId },
    });
  }

  async save(expense: Expense): Promise<void> {
    const receiptId = await this.saveReceipt(expense);
    await this.prisma.expenseDB.update({
      where: { id: expense.id },
      data: { ...toData(expense), receipt_id: receiptId },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.revolutTransactionDB.updateMany({
      where: { expense_id: id },
      data: { expense_id: null },
    });
    await this.prisma.expenseDB.delete({ where: { id } });
  }

  async listLinkedToBexio(): Promise<Expense[]> {
    const rows = await this.prisma.expenseDB.findMany({
      where: { bexio_expense_id: { not: null } },
      include,
    });
    return rows.map(toDomain);
  }

  async listLoneReceiptExpenses(): Promise<Expense[]> {
    const rows = await this.prisma.expenseDB.findMany({
      where: {
        receipt_id: { not: null },
        transaction: null,
        bexio_expense_id: null,
        bexio_entry_id: null,
        status: { notIn: ["BOOKED"] },
      },
      include,
      orderBy: { created_at: "desc" },
      take: 500,
    });
    return rows.map(toDomain).filter((e) => e.isLoneReceipt());
  }

  async listUnlinkedReceipts(): Promise<ReceiptProps[]> {
    const rows = await this.prisma.receiptDB.findMany({
      where: { expense: null },
      orderBy: { imported_at: "desc" },
      take: 500,
    });
    return rows.map(toReceipt);
  }

  async findReceipt(id: string) {
    const row = await this.prisma.receiptDB.findUnique({
      where: { id },
      include: { expense: { select: { id: true } } },
    });
    return row
      ? { ...toReceipt(row), expenseId: row.expense?.id ?? null }
      : null;
  }

  async listUnreadReceiptExpenses(limit: number): Promise<Expense[]> {
    const rows = await this.prisma.expenseDB.findMany({
      where: { receipt: { extracted_at: null } },
      include,
      orderBy: { created_at: "asc" },
      take: limit,
    });
    return rows.map(toDomain);
  }
}
