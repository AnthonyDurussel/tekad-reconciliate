import { describe, expect, it } from "vitest";
import type { RevolutTransactionDTO } from "@repo/models";
import { missingReceiptsText, totalsByCurrency } from "./missingReceipts";

const tx = (patch: Partial<RevolutTransactionDTO>): RevolutTransactionDTO => ({
  id: "1",
  revolutId: "r1",
  revolutAccountId: "acc",
  paymentAccountId: null,
  type: "card_payment",
  state: "completed",
  date: "2026-10-03",
  description: null,
  merchantName: "Migros",
  merchantCity: null,
  merchantCountry: null,
  mcc: null,
  amount: -12.5,
  currency: "CHF",
  billAmount: null,
  billCurrency: null,
  cardLast4: "1234",
  expenseId: null,
  ignored: false,
  ignoreReason: null,
  requiresReceipt: true,
  ...patch,
});

describe("missingReceiptsText", () => {
  it("liste date, commerçant et montant, triés par date", () => {
    const text = missingReceiptsText(
      [
        tx({ id: "2", date: "2026-10-05", merchantName: "SBB", amount: -40 }),
        tx({
          date: "2026-10-01",
          merchantName: "Amazon",
          amount: -20,
          billAmount: -21.3,
          billCurrency: "EUR",
          cardLast4: null,
        }),
      ],
      "Pièces manquantes",
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("Pièces manquantes");
    expect(lines[2]).toMatch(
      /^01\.10\.2026 — Amazon — 20[.,]00 CHF \(21[.,]30 EUR\)$/,
    );
    expect(lines[3]).toMatch(/^05\.10\.2026 — SBB — 40[.,]00 CHF — •••• 1234$/);
  });
});

describe("totalsByCurrency", () => {
  it("additionne les sorties par devise", () => {
    const totals = totalsByCurrency([
      tx({ amount: -10 }),
      tx({ amount: -5.5 }),
      tx({ amount: -3, currency: "EUR" }),
    ]);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatch(/^15[.,]50 CHF$/);
    expect(totals[1]).toMatch(/^3[.,]00 EUR$/);
  });
});
