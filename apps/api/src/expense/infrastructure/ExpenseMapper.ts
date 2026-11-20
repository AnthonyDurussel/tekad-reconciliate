import type { ExpenseDTO } from "@repo/models";
import type { ExpenseView } from "@/expense/application/usecases/ExpenseUseCases.js";
import { RevolutMapper } from "@/revolut/infrastructure/RevolutMapper.js";

export const ExpenseMapper = {
  toDTO({ expense, ctx }: ExpenseView, withTransaction = true): ExpenseDTO {
    const p = expense.snapshot;
    return {
      id: p.id,
      status: p.status,
      source: p.source,
      createdAt: p.createdAt.toISOString(),
      issues: expense.issues(ctx),
      reconciliation: expense.account(ctx)?.reconciliation ?? null,
      receiptId: p.receipt?.id ?? null,
      bexioFileId: p.receipt?.bexioFileId ?? null,
      fileName: p.receipt?.fileName ?? null,
      mimeType: p.receipt?.mimeType ?? null,
      importedAt: p.receipt?.importedAt.toISOString() ?? null,
      date: p.date,
      merchant: p.merchant,
      description: p.description,
      totalAmount: p.totalAmount,
      currency: p.currency,
      vatAmount: p.vatAmount,
      vatRate: p.vatRate,
      cardLast4: p.cardLast4,
      paymentMethod: p.paymentMethod,
      extraction: expense.extraction,
      extractedAt: p.extractedAt?.toISOString() ?? null,
      paymentAccountId: p.paymentAccountId,
      paymentAccountName: expense.account(ctx)?.name ?? null,
      paymentAccountSource: p.paymentAccountSource,
      categoryId: p.categoryId,
      categoryLabel: expense.category(ctx)?.label ?? null,
      categorySource: p.categorySource,
      debitAccountNo: p.debitAccountNo,
      creditAccountNo: p.creditAccountNo,
      bexioTaxId: p.bexioTaxId,
      transactionId: p.transactionId,
      transaction:
        withTransaction && ctx.transaction
          ? RevolutMapper.toDTO(ctx.transaction)
          : undefined,
      booking: expense.booking(ctx),
      bexioEntryId: p.bexioEntryId,
      bexioExpenseId: p.bexioExpenseId,
      bookedAt: p.bookedAt?.toISOString() ?? null,
      note: p.note,
      ignoreReason: p.ignoreReason,
    };
  },
};
