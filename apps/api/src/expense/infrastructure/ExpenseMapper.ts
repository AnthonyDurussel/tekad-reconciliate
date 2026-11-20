import type { ExpenseDTO } from "@repo/models";
import type { ExpenseView } from "@/expense/application/usecases/ExpenseUseCases.js";
import { RevolutMapper } from "@/revolut/infrastructure/RevolutMapper.js";

export const ExpenseMapper = {
  toDTO({ expense, ctx }: ExpenseView, withTransaction = true): ExpenseDTO {
    const p = expense.snapshot;
    return {
      id: p.id,
      status: p.status,
      bexioFileId: p.bexioFileId,
      fileName: p.fileName,
      mimeType: p.mimeType,
      importedAt: p.importedAt.toISOString(),
      date: p.date,
      merchant: p.merchant,
      description: p.description,
      totalAmount: p.totalAmount,
      currency: p.currency,
      vatAmount: p.vatAmount,
      vatRate: p.vatRate,
      cardLast4: p.cardLast4,
      paymentMethod: p.paymentMethod,
      extraction: p.extraction,
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
      bookedAt: p.bookedAt?.toISOString() ?? null,
      note: p.note,
      ignoreReason: p.ignoreReason,
    };
  },
};
