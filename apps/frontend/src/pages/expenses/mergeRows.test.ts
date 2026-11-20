import { describe, expect, it } from "vitest";
import {
  ExpenseIssueDTO,
  ExpenseStatusDTO,
  ReconciliationModeDTO,
  type BexioExpenseDTO,
  type ExpenseDTO,
} from "@repo/models";
import {
  NONE,
  NOT_IN_APP,
  apiIssueFilter,
  bexioLinkStates,
  bexioOnlyRows,
  listTotals,
  mergeRows,
  parseListIssueFilter,
  type ListFilters,
} from "./mergeRows";

const bexio = (patch: Partial<BexioExpenseDTO> = {}): BexioExpenseDTO => ({
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

const expense = (id: string, patch: Partial<ExpenseDTO> = {}): ExpenseDTO =>
  ({
    id,
    status: ExpenseStatusDTO.TO_REVIEW,
    date: "2026-10-01",
    bexioExpenseId: null,
    booking: { amountChf: 10 },
    ...patch,
  }) as ExpenseDTO;

const noFilter: ListFilters = {
  paymentAccountId: null,
  categoryId: null,
  status: null,
  issue: null,
};
const categories = [
  { id: "c1", bexioAccountNo: "6500" },
  { id: "c2", bexioAccountNo: "6570" },
];

describe("parseListIssueFilter / apiIssueFilter", () => {
  it("accepte not_in_app sans l'envoyer à l'API", () => {
    expect(parseListIssueFilter(NOT_IN_APP)).toBe(NOT_IN_APP);
    expect(parseListIssueFilter("MISSING_RECEIPT")).toBe(
      ExpenseIssueDTO.MISSING_RECEIPT,
    );
    expect(parseListIssueFilter("autre")).toBeNull();
    expect(apiIssueFilter(NOT_IN_APP)).toBeUndefined();
    expect(apiIssueFilter("ok")).toBe("ok");
    expect(apiIssueFilter(null)).toBeUndefined();
  });
});

describe("bexioOnlyRows", () => {
  const rows = [
    bexio({ id: "linked", expenseId: "e1" }),
    bexio({ id: "p1" }),
    bexio({ id: "p2", paymentAccountId: "p2" }),
    bexio({ id: "unknown", paymentAccountId: null }),
    bexio({ id: "untyped", bookingAccountNo: "6999" }),
    bexio({ id: "noAccount", bookingAccountNo: null }),
  ];
  const ids = (filters: Partial<ListFilters>) =>
    bexioOnlyRows(rows, { ...noFilter, ...filters }, categories).map(
      (b) => b.id,
    );

  it("seulement celles sans dépense dans l'application", () => {
    expect(ids({})).not.toContain("linked");
    expect(ids({})).toHaveLength(5);
  });

  it("filtre par compte payeur, none = compte inconnu", () => {
    expect(ids({ paymentAccountId: "p2" })).toEqual(["p2"]);
    expect(ids({ paymentAccountId: NONE })).toEqual(["unknown"]);
  });

  it("filtre par type via le compte de charge", () => {
    expect(ids({ categoryId: "c1" })).toEqual(["p1", "p2", "unknown"]);
    expect(ids({ categoryId: "c2" })).toEqual([]);
    expect(ids({ categoryId: "inconnu" })).toEqual([]);
    expect(ids({ categoryId: NONE })).toEqual(["untyped", "noAccount"]);
  });

  it("masquées par un statut ou un « À faire » de l'application", () => {
    expect(ids({ status: ExpenseStatusDTO.READY })).toEqual([]);
    expect(ids({ issue: ExpenseIssueDTO.MISSING_RECEIPT })).toEqual([]);
    expect(ids({ issue: "ok" })).toEqual([]);
    expect(ids({ issue: NOT_IN_APP })).toHaveLength(5);
  });
});

describe("mergeRows", () => {
  it("fusionne par date décroissante, sans date en dernier", () => {
    const rows = mergeRows(
      [
        expense("e1", { date: "2026-10-05" }),
        expense("e2", { date: "2026-10-01" }),
        expense("e3", { date: null }),
      ],
      [
        bexio({ id: "b1", paidOn: "2026-10-03" }),
        bexio({ id: "b2", paidOn: "2026-10-09" }),
        bexio({ id: "b3", expenseId: "e1" }),
      ],
      noFilter,
      categories,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "b:b2",
      "e:e1",
      "b:b1",
      "e:e2",
      "e:e3",
    ]);
  });

  it("garde l'ordre de l'API sans dépense bexio", () => {
    const rows = mergeRows(
      [
        expense("e1", { date: "2026-10-01" }),
        expense("e2", { date: "2026-10-05" }),
      ],
      [],
      noFilter,
      categories,
    );
    expect(rows.map((r) => r.key)).toEqual(["e:e1", "e:e2"]);
  });

  it("donne le n° bexio d'une dépense rattachée", () => {
    const [row] = mergeRows(
      [expense("e1", { bexioExpenseId: "b9" })],
      [bexio({ id: "b9", documentNo: "AU-00042", expenseId: "e1" })],
      noFilter,
      categories,
    );
    expect(row).toMatchObject({ kind: "expense", bexioDocumentNo: "AU-00042" });
  });

  it("not_in_app : les dépenses bexio seulement", () => {
    const rows = mergeRows(
      [expense("e1")],
      [bexio({ id: "b1" })],
      { ...noFilter, issue: NOT_IN_APP },
      categories,
    );
    expect(rows.map((r) => r.key)).toEqual(["b:b1"]);
  });
});

describe("listTotals", () => {
  it("additionne l'application et bexio à part, en CHF", () => {
    const totals = listTotals(
      mergeRows(
        [
          expense("e1", {
            booking: { amountChf: 12.5 } as ExpenseDTO["booking"],
          }),
          expense("e2", {
            booking: { amountChf: null } as ExpenseDTO["booking"],
          }),
        ],
        [
          bexio({ id: "b1", gross: 20 }),
          bexio({ id: "b2", gross: 99, currency: "EUR" }),
        ],
        noFilter,
        categories,
      ),
    );
    expect(totals).toEqual({
      app: { count: 2, chf: 12.5, unpriced: 1 },
      bexio: { count: 2, chf: 20, otherCurrency: 1 },
    });
  });
});

describe("bexioLinkStates", () => {
  it("pièce = fichier joint, bexio fait, relevé selon le compte", () => {
    expect(bexioLinkStates(bexio())).toEqual({
      receipt: "missing",
      bexio: "ok",
      reconciliation: "missing",
    });
    expect(
      bexioLinkStates(
        bexio({
          attachmentIds: ["u1"],
          reconciliation: ReconciliationModeDTO.BEXIO,
        }),
      ),
    ).toEqual({ receipt: "ok", bexio: "ok", reconciliation: "na" });
    expect(
      bexioLinkStates(bexio({ bexioReconciled: true })).reconciliation,
    ).toBe("ok");
  });
});
