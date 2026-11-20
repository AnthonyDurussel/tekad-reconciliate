import {
  BookingModeDTO,
  PaymentAccountKindDTO,
  ReconciliationModeDTO,
  StatementFormatDTO,
  type ExtractionDTO,
} from "@repo/models";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";

export const revolut: PaymentAccountProps = {
  id: "acc-rev",
  kind: PaymentAccountKindDTO.REVOLUT,
  name: "Revolut Business",
  bexioAccountNo: "1021",
  bexioBankAccountId: null,
  reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
  statementFormat: StatementFormatDTO.REVOLUT_BUSINESS,
  bookingMode: BookingModeDTO.MANUAL_ENTRY,
  revolutAccountId: "rev-chf",
  position: 0,
  active: true,
  cards: [{ id: "c1", last4: "4821", label: null, holder: null, active: true, maskedNumber: null }],
};

export const ubs: PaymentAccountProps = {
  id: "acc-ubs",
  kind: PaymentAccountKindDTO.UBS,
  name: "UBS",
  bexioAccountNo: "1020",
  bexioBankAccountId: null,
  reconciliation: ReconciliationModeDTO.BEXIO,
  statementFormat: null,
  bookingMode: BookingModeDTO.BEXIO_RECONCILIATION,
  revolutAccountId: null,
  position: 1,
  active: true,
  cards: [{ id: "c2", last4: "7777", label: null, holder: null, active: true, maskedNumber: null }],
};

export const personal: PaymentAccountProps = {
  id: "acc-cc",
  kind: PaymentAccountKindDTO.PERSONAL,
  name: "Compte courant Anthony",
  bexioAccountNo: "2210",
  bexioBankAccountId: null,
  reconciliation: ReconciliationModeDTO.NONE,
  statementFormat: null,
  bookingMode: BookingModeDTO.MANUAL_ENTRY,
  revolutAccountId: null,
  position: 2,
  active: true,
  cards: [{ id: "c3", last4: "1234", label: null, holder: null, active: true, maskedNumber: null }],
};

const category = (
  id: string,
  code: string,
  account: string,
  keywords: string[],
  mcc: string[] = [],
): ExpenseCategoryProps => ({
  id,
  bexioAccountId: null,
  code,
  label: code,
  bexioAccountNo: account,
  bexioTaxId: 12,
  vatRate: 8.1,
  keywords,
  mccCodes: mcc,
  position: 0,
  active: true,
});

export const categories = [
  category("cat-tel", "TEL", "6510", ["swisscom"]),
  category("cat-repas", "REPAS", "6640", [], ["5812"]),
  category("cat-it", "IT", "6570", ["google"]),
];

export const accounts = [revolut, ubs, personal];

export function extraction(over: Partial<ExtractionDTO> = {}): ExtractionDTO {
  return {
    merchant: "Swisscom (Schweiz) AG",
    date: "2026-11-02",
    totalAmount: 89.9,
    currency: "CHF",
    vatAmount: 6.74,
    vatRate: 8.1,
    cardLast4: "4821",
    paymentMethod: "card",
    categoryCode: null,
    description: "Abonnement mobile",
    confidence: 0.95,
    error: null,
    ...over,
  };
}

export function transaction(
  over: Partial<RevolutTransactionProps> = {},
): RevolutTransactionProps {
  return {
    id: "tx-1",
    revolutId: "r1",
    legId: "l1",
    revolutAccountId: "rev-chf",
    paymentAccountId: "acc-rev",
    type: "card_payment",
    state: "completed",
    occurredAt: new Date("2026-11-02T10:00:00Z"),
    description: "Swisscom",
    merchantName: "Swisscom",
    merchantCity: null,
    merchantCountry: "CH",
    mcc: "4814",
    amount: -89.9,
    currency: "CHF",
    billAmount: -89.9,
    billCurrency: "CHF",
    cardLast4: "4821",
    requiresReceipt: true,
    expenseId: null,
    ignored: false,
    ignoreReason: null,
    ...over,
  };
}
