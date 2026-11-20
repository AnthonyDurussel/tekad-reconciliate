import { describe, expect, it } from "vitest";
import { BexioAccountTypeDTO, ExpenseStatusDTO, type ExtractionDTO } from "@repo/models";
import { ConflictError, InvalidStateError } from "@/shared/domain/errors.js";
import { Expense, type ReceiptProps } from "@/expense/domain/Expense.js";
import { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import type { IExpenseRepository } from "@/expense/application/repositories/IExpenseRepository.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";
import type {
  BexioExpense,
  BexioExpenseInput,
  BexioManualEntryInput,
  IBexioGateway,
} from "@/bexio/application/ports/IBexioGateway.js";
import type { IReceiptReader } from "@/extraction/application/ports/IReceiptReader.js";
import { accounts, categories, extraction, transaction } from "./fixtures.js";

const copy = (e: Expense) => Expense.restore({ ...e.snapshot });

class MemoryExpenses implements Partial<IExpenseRepository> {
  rows = new Map<string, Expense>();
  /** Pièces détachées (sans dépense). */
  orphans: ReceiptProps[] = [];
  all() {
    return [...this.rows.values()];
  }
  async list() {
    return this.all().map(copy);
  }
  async findById(id: string) {
    const e = this.rows.get(id);
    return e ? copy(e) : null;
  }
  async existingFileIds(ids: string[]) {
    const known = new Set(this.all().map((e) => e.receipt?.bexioFileId));
    return new Set(ids.filter((id) => known.has(id)));
  }
  async setMissingFileUuids() {}
  async findByFileUuids(uuids: string[]) {
    return this.all()
      .filter((e) => uuids.includes(e.receipt?.bexioFileUuid ?? ""))
      .map(copy);
  }
  async findByBexioExpenseIds(ids: string[]) {
    return this.all()
      .filter((e) => ids.includes(e.snapshot.bexioExpenseId ?? ""))
      .map(copy);
  }
  async findByTransactionId(id: string) {
    const e = this.all().find((x) => x.transactionId === id);
    return e ? copy(e) : null;
  }
  async listByStatus(statuses: ExpenseStatusDTO[], limit?: number) {
    return this.all()
      .filter((e) => statuses.includes(e.status))
      .slice(0, limit)
      .map(copy);
  }
  async listUnreadReceiptExpenses(limit: number) {
    return this.all()
      .filter((e) => e.receipt && !e.receipt.extractedAt)
      .slice(0, limit)
      .map(copy);
  }
  async listLinkedToBexio() {
    return this.all().filter((e) => e.snapshot.bexioExpenseId).map(copy);
  }
  async listLoneReceiptExpenses() {
    return this.all().filter((e) => e.isLoneReceipt()).map(copy);
  }
  async listUnlinkedReceipts() {
    return this.orphans;
  }
  async findReceipt(id: string) {
    const owner = this.all().find((e) => e.receipt?.id === id);
    if (owner) return { ...owner.receipt!, expenseId: owner.id };
    const orphan = this.orphans.find((r) => r.id === id);
    return orphan ? { ...orphan, expenseId: null } : null;
  }
  async create(e: Expense) {
    this.rows.set(e.id, copy(e));
  }
  async save(e: Expense) {
    this.rows.set(e.id, copy(e));
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
}

class MemoryTransactions implements Partial<IRevolutTransactionRepository> {
  rows: RevolutTransactionProps[] = [];
  async findById(id: string) {
    return this.rows.find((t) => t.id === id) ?? null;
  }
  async findByIds(ids: string[]) {
    return this.rows.filter((t) => ids.includes(t.id));
  }
  async findByExpense(id: string) {
    return this.rows.find((t) => t.expenseId === id) ?? null;
  }
  async listUnmatched(from: Date, to: Date) {
    return this.rows.filter(
      (t) =>
        t.requiresReceipt && !t.ignored && !t.expenseId &&
        t.occurredAt >= from && t.occurredAt < to,
    );
  }
  async setExpense(id: string, expenseId: string | null) {
    this.rows.find((t) => t.id === id)!.expenseId = expenseId;
  }
  async clearExpense(expenseId: string) {
    for (const t of this.rows) if (t.expenseId === expenseId) t.expenseId = null;
  }
}

const settings = {
  listPaymentAccounts: async () => accounts.map((a) => ({ ...a, expenseCount: 0 })),
  listCategories: async () => categories.map((c) => ({ ...c, expenseCount: 0 })),
} as unknown as ISettingsRepository;

export const bexioExpense = (over: Partial<BexioExpense> = {}): BexioExpense => ({
  id: "11111111-1111-4111-8111-111111111111",
  documentNo: "AU-1",
  title: "Swisscom",
  vendor: "Swisscom AG",
  status: "DONE",
  paidOn: "2026-11-02",
  gross: 89.9,
  currency: "CHF",
  bookingAccountId: 10,
  bankAccountId: 5,
  transactionId: null,
  attachmentIds: [],
  ...over,
});

function setup(readings: Record<string, ExtractionDTO>) {
  const expenses = new MemoryExpenses();
  const txs = new MemoryTransactions();
  const entries: BexioManualEntryInput[] = [];
  const created: BexioExpenseInput[] = [];
  const bexioList: BexioExpense[] = [];
  const attached: { id: string; uuids: string[] }[] = [];
  const bexio: IBexioGateway = {
    configured: true,
    listInboxFiles: async () => [
      { id: "f1", uuid: "uuid-f1", name: "swisscom.pdf", mimeType: "application/pdf", createdAt: null },
      { id: "f2", uuid: "uuid-f2", name: "ubs.jpg", mimeType: "image/jpeg", createdAt: null },
    ],
    downloadFile: async (id) => ({
      fileName: `${id}.pdf`,
      mimeType: "application/pdf",
      data: Buffer.from(id),
    }),
    // 1021 Revolut est un compte bancaire de bexio ; 2210 (compte courant) non.
    listAccounts: async () => [
      { id: 2, accountNo: "1021", name: "Revolut", type: BexioAccountTypeDTO.ASSET, taxId: null, active: true },
      { id: 3, accountNo: "2210", name: "CC Anthony", type: BexioAccountTypeDTO.LIABILITY, taxId: null, active: true },
      { id: 10, accountNo: "6510", name: "Télécom", type: BexioAccountTypeDTO.EXPENSE, taxId: null, active: true },
    ],
    listTaxes: async () => [],
    listBankAccounts: async () => [{ id: 5, name: "Revolut", accountId: 2, iban: null }],
    fileUuid: async (id) => `uuid-${id}`,
    findFileByUuid: async () => null,
    listExpenses: async () => bexioList,
    getExpense: async (id) => bexioList.find((e) => e.id === id) ?? null,
    createExpense: async (input) => {
      created.push(input);
      return "exp-uuid-1";
    },
    attachFilesToExpense: async (id, uuids) => {
      attached.push({ id, uuids });
      const row = bexioList.find((e) => e.id === id);
      if (row) row.attachmentIds = [...row.attachmentIds, ...uuids];
    },
    createManualEntry: async (input) => {
      entries.push(input);
      return "bexio-42";
    },
  };
  const reader: IReceiptReader = {
    isConfigured: async () => true,
    read: async (file) => readings[file.data.toString()],
  };
  const useCases = new ExpenseUseCases(
    expenses as unknown as IExpenseRepository,
    settings,
    txs as unknown as IRevolutTransactionRepository,
    bexio,
    reader,
    new BexioExpenseUseCases(
      bexio,
      expenses as unknown as IExpenseRepository,
      settings,
    ),
  );
  return { useCases, expenses, txs, entries, created, bexioList, attached };
}

describe("ExpenseUseCases", () => {
  it("inbox → lecture → rapprochement → dépense bexio, pièce jointe", async () => {
    const { useCases, expenses, txs, entries, created } = setup({
      f1: extraction(),
      f2: extraction({ merchant: "Galaxus", cardLast4: "7777", totalAmount: 120 }),
    });
    txs.rows.push(transaction());
    expect(await useCases.importInbox()).toBe(2);
    expect(await useCases.importInbox()).toBe(0);
    expect(await useCases.extractPending()).toBe(2);

    const [swisscom, ubs] = expenses.all();
    expect(swisscom.transactionId).toBe("tx-1");
    expect(swisscom.status).toBe(ExpenseStatusDTO.READY);
    expect(txs.rows[0].expenseId).toBe(swisscom.id);
    // UBS : pas de recherche Revolut ; sans type reconnu, à compléter.
    expect(ubs.transactionId).toBeNull();
    expect(ubs.status).toBe(ExpenseStatusDTO.TO_REVIEW);

    const booked = await useCases.book(swisscom.id, "u1");
    expect(booked.expense.status).toBe(ExpenseStatusDTO.BOOKED);
    // Revolut (1021) est un compte bancaire bexio : une dépense, pas d'écriture.
    expect(booked.expense.snapshot.bexioExpenseId).toBe("exp-uuid-1");
    expect(booked.expense.snapshot.bexioEntryId).toBeNull();
    expect(entries).toHaveLength(0);
    expect(created[0]).toEqual({
      paidOn: "2026-11-02",
      title: expect.stringContaining("Swisscom"),
      amountChf: 89.9,
      bankAccountId: 5,
      bookingAccountId: 10,
      taxId: 12,
      attachmentIds: ["uuid-f1"],
    });
  });

  it("compte courant (pas un compte bancaire bexio) : écriture manuelle", async () => {
    const { useCases, expenses, entries, created } = setup({
      f1: extraction({ cardLast4: "1234" }),
      f2: extraction({ cardLast4: "1234" }),
    });
    await useCases.importInbox();
    await useCases.extractPending();
    const first = expenses.all()[0];
    const view = await useCases.book(first.id, "u1");
    expect(view.expense.snapshot.bexioEntryId).toBe("bexio-42");
    expect(created).toHaveLength(0);
    expect(entries[0]).toMatchObject({ debitAccountNo: "6510", creditAccountNo: "2210", amountChf: 89.9 });
    expect(entries[0].attachment?.data.toString()).toBe("f1");
  });

  it("UBS prête : marquée comptabilisée sans écriture", async () => {
    const { useCases, expenses, entries } = setup({
      f1: extraction({ cardLast4: "7777" }),
      f2: extraction({ cardLast4: "7777" }),
    });
    await useCases.importInbox();
    await useCases.extractPending();
    const first = expenses.all()[0];
    const view = await useCases.book(first.id, "u1");
    expect(view.expense.status).toBe(ExpenseStatusDTO.BOOKED);
    expect(view.expense.snapshot.bexioEntryId).toBeNull();
    expect(entries).toHaveLength(0);
  });

  it("une pièce à compléter ne se comptabilise pas", async () => {
    const { useCases, expenses } = setup({
      f1: extraction({ cardLast4: null }),
      f2: extraction({ cardLast4: null }),
    });
    await useCases.importInbox();
    await useCases.extractPending();
    const first = expenses.all()[0];
    await expect(useCases.book(first.id, null)).rejects.toThrow(InvalidStateError);
  });

  it("une transaction ne sert qu'une pièce", async () => {
    const { useCases, expenses, txs } = setup({ f1: extraction(), f2: extraction() });
    txs.rows.push(transaction());
    await useCases.importInbox();
    await useCases.extractPending();
    const [a, b] = expenses.all();
    expect([a.transactionId, b.transactionId].filter(Boolean)).toHaveLength(1);
    const other = a.transactionId ? b : a;
    await expect(useCases.match(other.id, "tx-1")).rejects.toThrow(ConflictError);
  });

  it("rapprochement manuel puis détachement", async () => {
    const { useCases, expenses, txs } = setup({
      f1: extraction({ totalAmount: 10 }),
      f2: extraction({ totalAmount: 11 }),
    });
    txs.rows.push(transaction());
    await useCases.importInbox();
    await useCases.extractPending();
    const first = expenses.all()[0];
    expect(first.transactionId).toBeNull();
    const matched = await useCases.match(first.id, "tx-1");
    expect(matched.expense.transactionId).toBe("tx-1");
    const detached = await useCases.match(first.id, null);
    expect(detached.expense.transactionId).toBeNull();
    expect(txs.rows[0].expenseId).toBeNull();
  });

  it("relevé : une dépense pour la sortie, puis sa pièce (la dépense de la pièce disparaît)", async () => {
    const { useCases, expenses, txs } = setup({
      f1: extraction({ totalAmount: 10 }),
      f2: extraction({ totalAmount: 11 }),
    });
    txs.rows.push(transaction());
    const view = await useCases.createFromTransaction("tx-1");
    expect(view.expense.snapshot.source).toBe("TRANSACTION");
    expect(view.expense.issues(view.ctx)).toEqual(["MISSING_RECEIPT", "NOT_IN_BEXIO"]);
    expect(txs.rows[0].expenseId).toBe(view.expense.id);
    await expect(useCases.createFromTransaction("tx-1")).rejects.toThrow(ConflictError);

    await useCases.importInbox();
    await useCases.extractPending();
    expect(expenses.all()).toHaveLength(3);
    const candidates = await useCases.receiptCandidates(view.expense.id);
    expect(candidates.map((c) => c.fileName)).toEqual(["swisscom.pdf", "ubs.jpg"]);
    const lone = candidates[0];
    const linked = await useCases.linkReceipt(view.expense.id, lone.id);
    expect(linked.expense.receipt?.fileName).toBe("swisscom.pdf");
    // Les champs venus du relevé restent ; la pièce complète le reste.
    expect(linked.expense.snapshot.totalAmount).toBe(89.9);
    expect(expenses.rows.has(lone.expenseId!)).toBe(false);
    expect(linked.expense.issues(linked.ctx)).toEqual(["NOT_IN_BEXIO"]);

    // Détachée, la pièce retrouve sa propre dépense.
    const back = await useCases.unlinkReceipt(view.expense.id);
    expect(back.expense.receipt).toBeNull();
    expect(expenses.all().filter((e) => e.receipt?.fileName === "swisscom.pdf")).toHaveLength(1);
  });

  it("dépense bexio rattachée : la pièce y est jointe, la dépense comptabilisée", async () => {
    const { useCases, expenses, bexioList, attached } = setup({
      f1: extraction(),
      f2: extraction({ cardLast4: "7777" }),
    });
    bexioList.push(bexioExpense());
    await useCases.importInbox();
    await useCases.extractPending();
    const first = expenses.all()[0];
    const candidates = await useCases.bexioCandidates(first.id);
    expect(candidates.map((c) => c.id)).toEqual([bexioList[0].id]);
    expect(candidates[0]).toMatchObject({
      bookingAccountNo: "6510",
      bankAccountNo: "1021",
      paymentAccountId: "acc-rev",
      expenseId: null,
    });
    const view = await useCases.linkBexio(first.id, bexioList[0].id);
    expect(view.expense.status).toBe(ExpenseStatusDTO.BOOKED);
    expect(attached).toEqual([{ id: bexioList[0].id, uuids: ["uuid-f1"] }]);
    const second = expenses.all()[1];
    await expect(useCases.linkBexio(second.id, bexioList[0].id)).rejects.toThrow(ConflictError);
    expect(await useCases.bexioCandidates(second.id)).toEqual([]);

    const unlinked = await useCases.unlinkBexio(first.id);
    expect(unlinked.expense.snapshot.bexioExpenseId).toBeNull();
    expect(unlinked.expense.status).not.toBe(ExpenseStatusDTO.BOOKED);
  });

  it("synchronisation : rattache par le fichier joint, détache une dépense bexio disparue", async () => {
    const { useCases, expenses, bexioList } = setup({
      f1: extraction(),
      f2: extraction({ cardLast4: "7777" }),
    });
    await useCases.importInbox();
    bexioList.push(bexioExpense({ attachmentIds: ["uuid-f2"] }));
    expect(await useCases.linkBexioExpenses()).toBe(1);
    expect(await useCases.linkBexioExpenses()).toBe(0);
    const ubs = expenses.all()[1];
    expect(ubs.snapshot.bexioExpenseId).toBe(bexioList[0].id);
    bexioList.length = 0;
    await useCases.linkBexioExpenses();
    expect(expenses.all()[1].snapshot.bexioExpenseId).toBeNull();
  });

  it("dépense créée depuis bexio : reprend la dépense dont la pièce y est jointe, sinon en crée une", async () => {
    const { useCases, expenses, bexioList } = setup({ f1: extraction(), f2: extraction() });
    await useCases.importInbox();
    bexioList.push(bexioExpense({ attachmentIds: ["uuid-f1"] }));
    bexioList.push(
      bexioExpense({ id: "22222222-2222-4222-8222-222222222222", vendor: "Coop", gross: 12, bookingAccountId: 10 }),
    );
    const linked = await useCases.createFromBexio(bexioList[0].id);
    expect(linked.expense.receipt?.fileName).toBe("swisscom.pdf");
    expect(expenses.all()).toHaveLength(2);
    await expect(useCases.createFromBexio(bexioList[0].id)).rejects.toThrow(ConflictError);

    const fresh = await useCases.createFromBexio(bexioList[1].id);
    expect(fresh.expense.snapshot).toMatchObject({
      source: "BEXIO",
      status: ExpenseStatusDTO.BOOKED,
      merchant: "Coop",
      totalAmount: 12,
      paymentAccountId: "acc-rev",
      categoryId: "cat-tel",
    });
    // Compte rapproché par relevé : il manque la pièce et la transaction.
    expect(fresh.expense.issues(fresh.ctx)).toEqual(["MISSING_RECEIPT", "NOT_RECONCILED"]);
    expect(expenses.all()).toHaveLength(3);
  });
});
