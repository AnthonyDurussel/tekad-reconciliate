import { describe, expect, it } from "vitest";
import { ExpenseIssueDTO, ExpenseStatusDTO, type ExpenseDTO, type RevolutTransactionDTO } from "@repo/models";
import { buildDashboard } from "@/dashboard/domain/buildDashboard.js";

const exp = (over: Partial<ExpenseDTO>): ExpenseDTO =>
  ({
    status: ExpenseStatusDTO.READY,
    paymentAccountId: "rev",
    paymentAccountName: "Revolut",
    categoryId: "tel",
    categoryLabel: "Télécom",
    booking: { amountChf: 10 },
    issues: [],
    ...over,
  }) as ExpenseDTO;

describe("buildDashboard", () => {
  it("compte par statut, somme par compte et type, hors ignorées", () => {
    const d = buildDashboard(
      "2026-11-01",
      "2026-11-30",
      [
        exp({ issues: [ExpenseIssueDTO.MISSING_RECEIPT, ExpenseIssueDTO.NOT_IN_BEXIO] }),
        exp({ booking: { amountChf: 5 } as ExpenseDTO["booking"], categoryId: null, categoryLabel: null }),
        exp({ status: ExpenseStatusDTO.IGNORED, booking: { amountChf: 100 } as ExpenseDTO["booking"] }),
        exp({ paymentAccountId: null, paymentAccountName: null, status: ExpenseStatusDTO.NEW, booking: { amountChf: null } as ExpenseDTO["booking"] }),
      ],
      [{ amount: -12.5, currency: "CHF" } as RevolutTransactionDTO],
    );
    expect(d.byStatus).toMatchObject({ READY: 2, IGNORED: 1, NEW: 1, BOOKED: 0 });
    expect(d.totalChf).toBe(15);
    expect(d.byAccount).toEqual([
      { key: "rev", label: "Revolut", count: 2, amountChf: 15 },
      { key: null, label: "Non classé", count: 1, amountChf: 0 },
    ]);
    expect(d.byCategory.map((c) => c.label)).toEqual(["Télécom", "Sans type"]);
    expect(d.issues).toEqual({ missingReceipt: 1, notInBexio: 1, notReconciled: 0 });
    expect(d.missingReceipts).toEqual({ count: 1, amountChf: 12.5 });
  });
});
