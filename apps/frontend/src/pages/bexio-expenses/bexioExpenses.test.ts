import { describe, expect, it } from "vitest";
import { ReconciliationModeDTO, type BexioExpenseDTO } from "@repo/models";
import { reconciliationState, summarize } from "./bexioExpenses";

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

describe("summarize", () => {
  it("compte toutes, rattachées et non rattachées, en CHF seulement", () => {
    const summary = summarize([
      expense({ id: "1", gross: 10, expenseId: "e1" }),
      expense({ id: "2", gross: 20.5 }),
      expense({ id: "3", gross: 99, currency: "EUR" }),
    ]);
    expect(summary.all).toEqual({ count: 3, amountChf: 30.5 });
    expect(summary.linked).toEqual({ count: 1, amountChf: 10 });
    expect(summary.unlinked).toEqual({ count: 2, amountChf: 20.5 });
  });

  it("vide : des zéros", () => {
    expect(summarize([]).all).toEqual({ count: 0, amountChf: 0 });
  });
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
