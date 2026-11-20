import { describe, expect, it } from "vitest";
import { ReconciliationModeDTO, type BexioExpenseDTO } from "@repo/models";
import { reconciliationState } from "./bexioExpenses";

const expense = (patch: Partial<BexioExpenseDTO> = {}): BexioExpenseDTO => ({
  id: "b1",
  documentNo: "AU-00001",
  title: null,
  vendor: "Migros",
  status: "DONE",
  paidOn: "2026-10-01",
  gross: 10,
  currency: "CHF",
  bookingAccountNo: "6500",
  bookingAccountName: "Frais de bureau",
  bankAccountNo: "1021",
  bankAccountName: "Revolut",
  paymentAccountId: "p1",
  paymentAccountName: "Revolut Business",
  reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
  bexioReconciled: false,
  attachmentIds: [],
  expenseId: null,
  ...patch,
});

describe("reconciliationState", () => {
  it("rapprochée dans bexio d'abord", () => {
    expect(
      reconciliationState(
        expense({
          bexioReconciled: true,
          reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
        }),
      ),
    ).toBe("inBexio");
  });

  it("sinon selon le compte payeur", () => {
    const of = (reconciliation: ReconciliationModeDTO | null) =>
      reconciliationState(expense({ reconciliation }));
    expect(of(ReconciliationModeDTO.BEXIO)).toBe("toReconcileInBexio");
    expect(of(ReconciliationModeDTO.STATEMENT_IMPORT)).toBe("byStatement");
    expect(of(ReconciliationModeDTO.NONE)).toBe("notRequired");
    expect(of(null)).toBe("unknownAccount");
  });
});
