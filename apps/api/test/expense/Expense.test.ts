import { describe, expect, it } from "vitest";
import { ExpenseStatusDTO, SuggestionSourceDTO } from "@repo/models";
import { InvalidStateError } from "@/shared/domain/errors.js";
import { Expense } from "@/expense/domain/Expense.js";
import {
  accounts,
  categories,
  extraction,
  transaction,
} from "./fixtures.js";

const ctx = { accounts, categories, transaction: null };
const fresh = () =>
  Expense.importFromInbox({
    id: "e1",
    bexioFileId: "f1",
    fileName: "ticket.pdf",
    mimeType: "application/pdf",
  });

describe("Expense", () => {
  it("importée : NEW", () => {
    expect(fresh().status).toBe(ExpenseStatusDTO.NEW);
  });

  it("la carte du ticket donne le compte, le mot-clé le type", () => {
    const e = fresh();
    e.applyExtraction(extraction(), ctx);
    const s = e.snapshot;
    expect(s.paymentAccountId).toBe("acc-rev");
    expect(s.paymentAccountSource).toBe(SuggestionSourceDTO.CARD);
    expect(s.categoryId).toBe("cat-tel");
    expect(s.categorySource).toBe(SuggestionSourceDTO.RULE);
    // Revolut sans transaction : à compléter.
    expect(e.status).toBe(ExpenseStatusDTO.TO_REVIEW);
    expect(e.booking(ctx).missing).toEqual(["transaction"]);
  });

  it("rapprochée de sa transaction : prête, écriture 6510 / 1021", () => {
    const e = fresh();
    e.applyExtraction(extraction(), ctx);
    const tx = transaction();
    e.attachTransaction(tx, ctx);
    const full = { ...ctx, transaction: tx };
    expect(e.status).toBe(ExpenseStatusDTO.READY);
    expect(e.booking(full)).toMatchObject({
      debitAccountNo: "6510",
      creditAccountNo: "1021",
      amountChf: 89.9,
      bexioTaxId: 12,
      missing: [],
    });
  });

  it("carte UBS : prête sans transaction (rapprochement dans bexio)", () => {
    const e = fresh();
    e.applyExtraction(extraction({ cardLast4: "7777" }), ctx);
    expect(e.snapshot.paymentAccountId).toBe("acc-ubs");
    expect(e.status).toBe(ExpenseStatusDTO.READY);
  });

  it("sans carte : le compte vient de la transaction rapprochée", () => {
    const e = fresh();
    e.applyExtraction(extraction({ cardLast4: null }), ctx);
    expect(e.snapshot.paymentAccountId).toBeNull();
    e.attachTransaction(transaction(), ctx);
    expect(e.snapshot.paymentAccountSource).toBe(SuggestionSourceDTO.TRANSACTION);
    expect(e.status).toBe(ExpenseStatusDTO.READY);
  });

  it("type : MCC de la transaction, puis proposition de l'IA", () => {
    const e = fresh();
    e.applyExtraction(
      extraction({ merchant: "Chez Mario", description: null, cardLast4: "1234", categoryCode: "IT" }),
      ctx,
    );
    expect(e.snapshot.categoryId).toBe("cat-it");
    expect(e.snapshot.categorySource).toBe(SuggestionSourceDTO.AI);
    e.attachTransaction(transaction({ mcc: "5812", merchantName: "Chez Mario" }), ctx);
    expect(e.snapshot.categoryId).toBe("cat-repas");
  });

  it("une saisie manuelle résiste à la relecture", () => {
    const e = fresh();
    e.applyExtraction(extraction(), ctx);
    e.update({ totalAmount: 90, paymentAccountId: "acc-cc", categoryId: "cat-it" }, ctx);
    e.applyExtraction(extraction({ totalAmount: 1, cardLast4: "7777" }), ctx);
    const s = e.snapshot;
    expect(s.totalAmount).toBe(90);
    expect(s.paymentAccountId).toBe("acc-cc");
    expect(s.paymentAccountSource).toBe(SuggestionSourceDTO.MANUAL);
    expect(s.categoryId).toBe("cat-it");
    expect(s.cardLast4).toBe("7777");
    // Compte courant : prêt sans transaction, crédit 2210.
    expect(e.status).toBe(ExpenseStatusDTO.READY);
    expect(e.booking(ctx).creditAccountNo).toBe("2210");
  });

  it("une lecture en échec laisse la pièce à compléter", () => {
    const e = fresh();
    e.applyExtraction(
      { ...extraction(), merchant: null, date: null, totalAmount: null, cardLast4: null, error: "format" },
      ctx,
    );
    expect(e.status).toBe(ExpenseStatusDTO.TO_REVIEW);
  });

  it("comptabilisée : figée jusqu'à l'annulation", () => {
    const e = fresh();
    e.applyExtraction(extraction({ cardLast4: "7777" }), ctx);
    e.markBooked(null, "u1");
    expect(e.status).toBe(ExpenseStatusDTO.BOOKED);
    expect(() => e.update({ note: "x" }, ctx)).toThrow(InvalidStateError);
    expect(() => e.markBooked(null, "u1")).toThrow(InvalidStateError);
    e.unbook(ctx);
    expect(e.status).toBe(ExpenseStatusDTO.READY);
  });

  it("ignorer / restaurer", () => {
    const e = fresh();
    e.applyExtraction(extraction(), ctx);
    e.ignore("doublon");
    expect(e.status).toBe(ExpenseStatusDTO.IGNORED);
    e.refresh(ctx);
    expect(e.status).toBe(ExpenseStatusDTO.IGNORED);
    e.restoreFromIgnored(ctx);
    expect(e.status).toBe(ExpenseStatusDTO.TO_REVIEW);
  });
});
