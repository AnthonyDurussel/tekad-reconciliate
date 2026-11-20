import { describe, expect, it } from "vitest";
import {
  accountForCard,
  autoMatch,
  bookingProposal,
  BookingModeDTO,
  categoryByRules,
  detectCardLast4,
  expenseStatus,
  ExpenseStatusDTO,
  last4OfMasked,
  merchantSimilarity,
  PaymentAccountKindDTO,
  requiresReceipt,
  scoreMatch,
} from "../src/index.js";

describe("detectCardLast4", () => {
  it.each([
    ["VISA **** **** **** 4821", "4821"],
    ["Mastercard XXXXXXXXXXXX1234", "1234"],
    ["Carte: xxxx-9876", "9876"],
    ["Card No. ************5531\nTotal CHF 12.50", "5531"],
    ["5354 56** **** 7788 Debit Mastercard", "7788"],
    ["Karte ...0042", "0042"],
  ])("lit %s", (text, last4) => {
    expect(detectCardLast4(text)).toBe(last4);
  });

  it("ne lit pas un total ou une date", () => {
    expect(detectCardLast4("Total CHF 1234.50\n12.03.2026")).toBeNull();
    expect(detectCardLast4(null)).toBeNull();
  });

  it("last4OfMasked", () => {
    expect(last4OfMasked("459876******1234")).toBe("1234");
    expect(last4OfMasked(null)).toBeNull();
  });
});

const accounts = [
  { id: "rev", active: true, cards: [{ last4: "4821" }] },
  { id: "ubs", active: true, cards: [{ last4: "1111", active: false }] },
  { id: "old", active: false, cards: [{ last4: "2222" }] },
];

describe("accountForCard", () => {
  it("retrouve le compte d'une carte active", () => {
    expect(accountForCard("4821", accounts)?.id).toBe("rev");
  });
  it("ignore une carte ou un compte inactif", () => {
    expect(accountForCard("1111", accounts)).toBeNull();
    expect(accountForCard("2222", accounts)).toBeNull();
    expect(accountForCard(null, accounts)).toBeNull();
  });
});

describe("categoryByRules", () => {
  const categories = [
    { id: "tel", active: true, keywords: ["swisscom", "salt"], mccCodes: ["4814"] },
    { id: "it", active: true, keywords: ["google", "google cloud"], mccCodes: [] },
    { id: "resto", active: true, keywords: [], mccCodes: ["5812"] },
    { id: "off", active: false, keywords: ["sbb"], mccCodes: [] },
  ];
  it("mot-clé, le plus long gagne", () => {
    expect(categoryByRules({ merchant: "Swisscom (Schweiz) AG" }, categories)?.id).toBe("tel");
    expect(categoryByRules({ merchant: "Google Cloud EMEA" }, categories)?.id).toBe("it");
  });
  it("ne coupe pas un mot", () => {
    expect(categoryByRules({ merchant: "Basalt Bar" }, categories)).toBeNull();
  });
  it("puis le MCC", () => {
    expect(categoryByRules({ merchant: "Chez Mario", mcc: "5812" }, categories)?.id).toBe("resto");
  });
  it("ignore un type inactif", () => {
    expect(categoryByRules({ merchant: "SBB CFF FFS" }, categories)).toBeNull();
  });
});

describe("merchantSimilarity", () => {
  it("rapproche les variantes", () => {
    expect(merchantSimilarity("Migros Lausanne", "MIGROS")).toBe(1);
    expect(merchantSimilarity("Coop Pronto", "Migros")).toBe(0);
  });
});

describe("requiresReceipt", () => {
  it("sorties par carte et virements", () => {
    expect(requiresReceipt({ type: "card_payment", state: "completed", amount: -10 })).toBe(true);
    expect(requiresReceipt({ type: "transfer", state: "completed", amount: -10 })).toBe(true);
  });
  it("pas les entrées, frais, changes ni refus", () => {
    expect(requiresReceipt({ type: "card_payment", state: "completed", amount: 10 })).toBe(false);
    expect(requiresReceipt({ type: "fee", state: "completed", amount: -1 })).toBe(false);
    expect(requiresReceipt({ type: "exchange", state: "completed", amount: -100 })).toBe(false);
    expect(requiresReceipt({ type: "card_payment", state: "declined", amount: -10 })).toBe(false);
  });
});

const tx = (over: Partial<Parameters<typeof scoreMatch>[1]> = {}) => ({
  date: "2026-11-02",
  amount: -42.5,
  currency: "CHF",
  billAmount: -42.5,
  billCurrency: "CHF",
  merchantName: "Migros",
  description: "Migros Lausanne",
  cardLast4: "4821",
  ...over,
});

const expense = {
  date: "2026-11-02",
  totalAmount: 42.5,
  currency: "CHF",
  merchant: "MIGROS Lausanne Flon",
  cardLast4: "4821",
};

describe("scoreMatch / autoMatch", () => {
  it("couple parfait", () => {
    const s = scoreMatch(expense, tx());
    expect(s.score).toBe(100);
    expect(s.reasons).toEqual(["amount", "sameDay", "card", "merchant"]);
  });
  it("le montant est éliminatoire", () => {
    expect(scoreMatch(expense, tx({ amount: -42.6, billAmount: -42.6 })).score).toBe(0);
  });
  it("devise étrangère : montant facturé", () => {
    const eur = { ...expense, currency: "EUR", totalAmount: 20 };
    expect(
      scoreMatch(eur, tx({ amount: -19.4, billAmount: -20, billCurrency: "EUR" })).score,
    ).toBeGreaterThan(70);
  });
  it("trop loin dans le temps", () => {
    expect(scoreMatch(expense, tx({ date: "2026-11-12" })).score).toBe(0);
  });
  it("une autre carte pénalise", () => {
    expect(scoreMatch(expense, tx({ cardLast4: "9999" })).score).toBeLessThan(70);
  });
  it("refuse l'ambiguïté", () => {
    const a = tx();
    const b = tx({ description: "Migros" });
    expect(autoMatch(expense, [a, b])).toBeNull();
    expect(autoMatch(expense, [a, tx({ amount: -10, billAmount: -10 })])).toBe(a);
  });
});

describe("expenseStatus / bookingProposal", () => {
  const revolut = {
    kind: PaymentAccountKindDTO.REVOLUT,
    bexioAccountNo: "1021",
    bookingMode: BookingModeDTO.MANUAL_ENTRY,
  };
  const category = { bexioAccountNo: "6570", bexioTaxId: 3, vatRate: 8.1, label: "Informatique" };
  const base = {
    status: ExpenseStatusDTO.TO_REVIEW,
    extracted: true,
    date: "2026-11-02",
    totalAmount: 42.5,
    paymentAccount: revolut,
    hasCategory: true,
    transactionId: null,
  };

  it("Revolut sans transaction reste à compléter", () => {
    expect(expenseStatus(base)).toBe(ExpenseStatusDTO.TO_REVIEW);
    expect(expenseStatus({ ...base, transactionId: "t" })).toBe(ExpenseStatusDTO.READY);
  });
  it("UBS : prête sans transaction", () => {
    expect(
      expenseStatus({ ...base, paymentAccount: { kind: PaymentAccountKindDTO.UBS } }),
    ).toBe(ExpenseStatusDTO.READY);
  });
  it("garde BOOKED, NEW tant que non lue", () => {
    expect(expenseStatus({ ...base, status: ExpenseStatusDTO.BOOKED })).toBe(ExpenseStatusDTO.BOOKED);
    expect(expenseStatus({ ...base, extracted: false })).toBe(ExpenseStatusDTO.NEW);
  });

  it("propose débit charge / crédit compte de paiement", () => {
    const p = bookingProposal({
      date: "2026-11-02",
      merchant: "Google",
      description: null,
      totalAmount: 20,
      currency: "EUR",
      transactionAmountChf: -19.37,
      paymentAccount: revolut,
      category,
      debitAccountNo: null,
      creditAccountNo: null,
      bexioTaxId: null,
      transactionId: "t",
    });
    expect(p).toMatchObject({
      amountChf: 19.37,
      debitAccountNo: "6570",
      creditAccountNo: "1021",
      bexioTaxId: 3,
      description: "Google — Informatique",
      missing: [],
    });
  });
  it("devise étrangère sans transaction : montant CHF manquant", () => {
    const p = bookingProposal({
      date: "2026-11-02",
      merchant: "Hotel",
      description: null,
      totalAmount: 100,
      currency: "EUR",
      transactionAmountChf: null,
      paymentAccount: { ...revolut, kind: PaymentAccountKindDTO.PERSONAL, bexioAccountNo: "2210" },
      category,
      debitAccountNo: "6640",
      creditAccountNo: null,
      bexioTaxId: null,
      transactionId: null,
    });
    expect(p.debitAccountNo).toBe("6640");
    expect(p.missing).toEqual(["amountChf"]);
  });
});
