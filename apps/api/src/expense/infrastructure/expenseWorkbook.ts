import type { ExpenseDTO } from "@repo/models";
import { EXPENSE_STATUS_LABELS } from "@repo/models";
import {
  addSheet,
  FMT_CHF,
  newWorkbook,
} from "@/shared/infrastructure/excel/workbook.js";

/** Export Excel des pièces filtrées, avec l'imputation proposée. */
export function expenseWorkbook(rows: ExpenseDTO[]) {
  const workbook = newWorkbook();
  addSheet<ExpenseDTO>(
    workbook,
    "Pièces",
    [
      { header: "Date", value: (r) => r.date, width: 12 },
      { header: "Commerçant", value: (r) => r.merchant, width: 28 },
      { header: "Description", value: (r) => r.description, width: 32 },
      { header: "Montant", value: (r) => r.totalAmount, numFmt: FMT_CHF },
      { header: "Devise", value: (r) => r.currency, width: 8 },
      { header: "TVA", value: (r) => r.vatAmount, numFmt: FMT_CHF },
      {
        header: "Carte",
        value: (r) => (r.cardLast4 ? `•••• ${r.cardLast4}` : null),
      },
      {
        header: "Compte de paiement",
        value: (r) => r.paymentAccountName,
        width: 24,
      },
      { header: "Type de dépense", value: (r) => r.categoryLabel, width: 24 },
      {
        header: "Montant CHF",
        value: (r) => r.booking.amountChf,
        numFmt: FMT_CHF,
      },
      { header: "Débit", value: (r) => r.booking.debitAccountNo, width: 8 },
      { header: "Crédit", value: (r) => r.booking.creditAccountNo, width: 8 },
      { header: "Code TVA", value: (r) => r.booking.bexioTaxId, width: 9 },
      {
        header: "Revolut",
        value: (r) => (r.transactionId ? "oui" : null),
        width: 9,
      },
      {
        header: "Statut",
        value: (r) => EXPENSE_STATUS_LABELS[r.status],
        width: 14,
      },
      { header: "Écriture bexio", value: (r) => r.bexioEntryId },
      { header: "Fichier", value: (r) => r.fileName, width: 30 },
      { header: "Note", value: (r) => r.note, width: 30 },
    ],
    rows,
  );
  return workbook;
}
