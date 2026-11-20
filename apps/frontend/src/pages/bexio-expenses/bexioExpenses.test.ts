import { describe, expect, it } from "vitest";
import {
  BexioExpenseIssueDTO,
  ExpenseStatusDTO,
  type BexioExpenseDTO,
  type ExpenseDTO,
} from "@repo/models";
import {
  candidateWindow,
  filterByIssue,
  matchesCandidateSearch,
  parseIssueFilter,
  rankCandidates,
  summarize,
} from "./bexioExpenses";

const bexio = (patch: Partial<BexioExpenseDTO>): BexioExpenseDTO => ({
  id: "b1",
  documentNo: "AU-00001",
  title: null,
  vendor: "Migros",
  status: "DONE",
  paidOn: "2026-10-10",
  gross: 50,
  currency: "CHF",
  bookingAccountNo: "6500",
  bookingAccountName: "Frais de bureau",
  paymentAccountId: "acc",
  paymentAccountName: "UBS",
  reconciliation: null,
  attachmentCount: 0,
  expenseId: null,
  expenseFileName: null,
  bexioReconciled: false,
  statementTransactionId: null,
  reconciled: null,
  issues: [],
  syncedAt: "2026-10-11T00:00:00Z",
  ...patch,
});

const receipt = (patch: Partial<ExpenseDTO>): ExpenseDTO =>
  ({
    id: "e1",
    status: ExpenseStatusDTO.READY,
    fileName: "ticket.pdf",
    date: "2026-10-10",
    merchant: "Migros",
    description: null,
    totalAmount: 50,
    currency: "CHF",
    paymentAccountName: null,
    bexioExpenseId: null,
    booking: { amountChf: null },
    ...patch,
  }) as ExpenseDTO;

describe("issue filter", () => {
  const rows = [
    bexio({ id: "ok" }),
    bexio({ id: "missing", issues: [BexioExpenseIssueDTO.MISSING_RECEIPT] }),
    bexio({
      id: "both",
      issues: [
        BexioExpenseIssueDTO.MISSING_RECEIPT,
        BexioExpenseIssueDTO.NOT_RECONCILED,
      ],
    }),
    bexio({ id: "draft", issues: [BexioExpenseIssueDTO.DRAFT], gross: 7 }),
  ];
  const ids = (list: BexioExpenseDTO[]) => list.map((e) => e.id);

  it("« à traiter » garde toute dépense avec un problème", () => {
    expect(ids(filterByIssue(rows, "todo"))).toEqual([
      "missing",
      "both",
      "draft",
    ]);
  });
  it("filtre par problème, ou sans problème", () => {
    expect(
      ids(filterByIssue(rows, BexioExpenseIssueDTO.MISSING_RECEIPT)),
    ).toEqual(["missing", "both"]);
    expect(
      ids(filterByIssue(rows, BexioExpenseIssueDTO.NOT_RECONCILED)),
    ).toEqual(["both"]);
    expect(ids(filterByIssue(rows, "ok"))).toEqual(["ok"]);
    expect(filterByIssue(rows, "all")).toHaveLength(4);
  });
  it("lit le filtre de l'URL", () => {
    expect(parseIssueFilter("todo")).toBe("todo");
    expect(parseIssueFilter("MISSING_RECEIPT")).toBe(
      BexioExpenseIssueDTO.MISSING_RECEIPT,
    );
    expect(parseIssueFilter("DRAFT")).toBe("all");
    expect(parseIssueFilter(null)).toBe("all");
  });
  it("résume nombres et montants CHF", () => {
    const summary = summarize([
      ...rows,
      bexio({ id: "eur", currency: "EUR", gross: 100 }),
    ]);
    expect(summary.all).toEqual({ count: 5, amountChf: 157 });
    expect(summary.missingReceipt).toEqual({ count: 2, amountChf: 100 });
    expect(summary.notReconciled).toEqual({ count: 1, amountChf: 50 });
    expect(summary.ok).toEqual({ count: 2, amountChf: 50 });
  });
});

describe("rankCandidates", () => {
  it("écarte les pièces ignorées ou déjà liées, trie par montant puis date", () => {
    const ranked = rankCandidates(bexio({ gross: 50, paidOn: "2026-10-10" }), [
      receipt({ id: "far-amount", totalAmount: 80 }),
      receipt({ id: "ignored", status: ExpenseStatusDTO.IGNORED }),
      receipt({ id: "linked", bexioExpenseId: "other" }),
      receipt({ id: "late", date: "2026-10-15" }),
      receipt({ id: "exact" }),
      receipt({ id: "no-amount", totalAmount: null }),
      receipt({
        id: "chf",
        totalAmount: 52,
        currency: "EUR",
        booking: { amountChf: 50 } as ExpenseDTO["booking"],
        date: "2026-10-12",
      }),
    ]);
    expect(ranked.map((c) => c.expense.id)).toEqual([
      "exact",
      "chf",
      "late",
      "far-amount",
      "no-amount",
    ]);
    expect(ranked[0]).toMatchObject({ amountGap: 0, dayGap: 0 });
    expect(ranked[3].amountGap).toBe(30);
    expect(ranked[4].amountGap).toBeNull();
  });

  it("cherche dans le fichier et le commerçant", () => {
    const r = receipt({ fileName: "Facture-Swisscom.pdf", merchant: null });
    expect(matchesCandidateSearch(r, "swisscom")).toBe(true);
    expect(matchesCandidateSearch(r, "coop")).toBe(false);
    expect(matchesCandidateSearch(r, "  ")).toBe(true);
  });

  it("cherche ±10 jours autour du paiement", () => {
    const fallback = { from: "2026-01-01", to: "2026-12-31" };
    expect(candidateWindow("2026-10-05", fallback)).toEqual({
      from: "2026-09-25",
      to: "2026-10-15",
    });
    expect(candidateWindow(null, fallback)).toBe(fallback);
  });
});
