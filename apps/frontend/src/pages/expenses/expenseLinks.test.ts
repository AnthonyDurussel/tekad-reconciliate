import { describe, expect, it } from "vitest";
import {
  ExpenseIssueDTO,
  ExpenseStatusDTO,
  ReconciliationModeDTO,
  type ExpenseDTO,
  type ReceiptDTO,
} from "@repo/models";
import {
  expenseLabel,
  linkStates,
  matchesReceiptSearch,
  parseIssueFilter,
  rankReceipts,
} from "./expenseLinks";

const links = (
  patch: Partial<Parameters<typeof linkStates>[0]> = {},
): Parameters<typeof linkStates>[0] => ({
  issues: [],
  receiptId: null,
  bexioExpenseId: null,
  bexioEntryId: null,
  transactionId: null,
  reconciliation: null,
  status: ExpenseStatusDTO.TO_REVIEW,
  ...patch,
});

const receipt = (
  id: string,
  extraction: Partial<NonNullable<ReceiptDTO["extraction"]>> | null,
  patch: Partial<ReceiptDTO> = {},
): ReceiptDTO => ({
  id,
  bexioFileId: `f-${id}`,
  bexioFileUuid: null,
  fileName: `${id}.pdf`,
  mimeType: "application/pdf",
  importedAt: "2026-10-01T08:00:00Z",
  extractedAt: extraction ? "2026-10-01T08:01:00Z" : null,
  extraction: extraction
    ? {
        merchant: null,
        date: null,
        totalAmount: null,
        currency: "CHF",
        vatAmount: null,
        vatRate: null,
        cardLast4: null,
        paymentMethod: null,
        categoryCode: null,
        description: null,
        confidence: null,
        ...extraction,
      }
    : null,
  expenseId: null,
  ...patch,
});

const expense = (patch: Partial<ExpenseDTO>): ExpenseDTO =>
  ({
    date: "2026-10-10",
    totalAmount: 42.5,
    booking: { amountChf: 42.5 },
    ...patch,
  }) as ExpenseDTO;

describe("parseIssueFilter", () => {
  it("accepte un problème ou `ok`, sinon rien", () => {
    expect(parseIssueFilter("MISSING_RECEIPT")).toBe(
      ExpenseIssueDTO.MISSING_RECEIPT,
    );
    expect(parseIssueFilter("ok")).toBe("ok");
    expect(parseIssueFilter("all")).toBeNull();
    expect(parseIssueFilter(null)).toBeNull();
  });
});

describe("expenseLabel", () => {
  it("commerçant, puis fichier, puis libellé du relevé", () => {
    expect(
      expenseLabel({ merchant: "Coop", fileName: "a.pdf", description: null }),
    ).toBe("Coop");
    expect(
      expenseLabel({ merchant: null, fileName: "a.pdf", description: null }),
    ).toBe("a.pdf");
    expect(
      expenseLabel({
        merchant: null,
        fileName: null,
        description: null,
        transaction: {
          merchantName: null,
          description: "To Swisscom",
        } as ExpenseDTO["transaction"],
      }),
    ).toBe("To Swisscom");
    expect(
      expenseLabel({ merchant: null, fileName: null, description: null }),
    ).toBeNull();
  });
});

describe("linkStates", () => {
  it("une dépense sans rien : pièce à rattacher, bexio à faire selon l'API", () => {
    expect(
      linkStates(
        links({
          issues: [
            ExpenseIssueDTO.MISSING_RECEIPT,
            ExpenseIssueDTO.NOT_IN_BEXIO,
          ],
        }),
      ),
    ).toEqual({ receipt: "missing", bexio: "missing", reconciliation: "na" });
  });

  it("tout fait", () => {
    expect(
      linkStates(
        links({
          receiptId: "r1",
          bexioExpenseId: "b1",
          transactionId: "t1",
          reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
          status: ExpenseStatusDTO.BOOKED,
        }),
      ),
    ).toEqual({ receipt: "ok", bexio: "ok", reconciliation: "ok" });
  });

  it("une écriture manuelle ou une comptabilisation par bexio compte comme « dans bexio »", () => {
    expect(linkStates(links({ bexioEntryId: "12" })).bexio).toBe("ok");
    expect(linkStates(links({ status: ExpenseStatusDTO.BOOKED })).bexio).toBe(
      "ok",
    );
  });

  it("rapprochement exigé seulement pour un compte importé", () => {
    expect(
      linkStates(
        links({ reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT }),
      ).reconciliation,
    ).toBe("missing");
    expect(
      linkStates(links({ reconciliation: ReconciliationModeDTO.BEXIO }))
        .reconciliation,
    ).toBe("na");
  });

  it("une dépense ignorée n'a plus rien à faire", () => {
    expect(
      linkStates(
        links({
          status: ExpenseStatusDTO.IGNORED,
          reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
        }),
      ),
    ).toEqual({ receipt: "na", bexio: "na", reconciliation: "na" });
  });
});

describe("rankReceipts", () => {
  it("le montant le plus proche d'abord, puis la date, les inconnus en dernier", () => {
    const ranked = rankReceipts(expense({}), [
      receipt("none", null),
      receipt("far", { totalAmount: 10, date: "2026-10-10" }),
      receipt("exactLate", { totalAmount: 42.5, date: "2026-10-20" }),
      receipt("exact", { totalAmount: -42.5, date: "2026-10-11" }),
    ]);
    expect(ranked.map((r) => r.receipt.id)).toEqual([
      "exact",
      "exactLate",
      "far",
      "none",
    ]);
    expect(ranked[0]).toMatchObject({ amountGap: 0, dayGap: 1 });
    expect(ranked[3]).toMatchObject({ amountGap: null, dayGap: null });
  });
});

describe("matchesReceiptSearch", () => {
  const r = receipt("scan", { merchant: "Migros", totalAmount: 12.3 });
  it("cherche dans le fichier, le commerçant, le montant", () => {
    expect(matchesReceiptSearch(r, "")).toBe(true);
    expect(matchesReceiptSearch(r, "migr")).toBe(true);
    expect(matchesReceiptSearch(r, "SCAN.pdf")).toBe(true);
    expect(matchesReceiptSearch(r, "12.30")).toBe(true);
    expect(matchesReceiptSearch(r, "coop")).toBe(false);
  });
});
