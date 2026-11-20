import { describe, expect, it } from "vitest";
import { BexioAccountTypeDTO, ExpenseStatusDTO, type ExtractionDTO } from "@repo/models";
import { ConflictError, InvalidStateError } from "@/shared/domain/errors.js";
import { Expense } from "@/expense/domain/Expense.js";
import { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import type { IExpenseRepository } from "@/expense/application/repositories/IExpenseRepository.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";
import type {
  BexioExpenseInput,
  BexioManualEntryInput,
  IBexioGateway,
} from "@/bexio/application/ports/IBexioGateway.js";
import type { IReceiptReader } from "@/extraction/application/ports/IReceiptReader.js";
import { accounts, categories, extraction, transaction } from "./fixtures.js";

class MemoryExpenses implements Partial<IExpenseRepository> {
  rows = new Map<string, Expense>();
  async list() {
    return [...this.rows.values()];
  }
  async findById(id: string) {
    const e = this.rows.get(id);
    return e ? Expense.restore({ ...e.snapshot }) : null;
  }
  async existingFileIds(ids: string[]) {
    const known = new Set([...this.rows.values()].map((e) => e.snapshot.bexioFileId));
    return new Set(ids.filter((id) => known.has(id)));
  }
  async setMissingFileUuids() {}
  async findByFileUuids(uuids: string[]) {
    return [...this.rows.values()].filter((e) => uuids.includes(e.snapshot.bexioFileUuid ?? ""));
  }
  async findByBexioExpenseIds(ids: string[]) {
    return [...this.rows.values()].filter((e) => ids.includes(e.snapshot.bexioExpenseId ?? ""));
  }
  async listByStatus(statuses: ExpenseStatusDTO[], limit?: number) {
    return [...this.rows.values()]
      .filter((e) => statuses.includes(e.status))
      .slice(0, limit)
      .map((e) => Expense.restore({ ...e.snapshot }));
  }
  async create(e: Expense) {
    this.rows.set(e.id, Expense.restore({ ...e.snapshot }));
  }
  async save(e: Expense) {
    this.rows.set(e.id, Expense.restore({ ...e.snapshot }));
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

function setup(readings: Record<string, ExtractionDTO>) {
  const expenses = new MemoryExpenses();
  const txs = new MemoryTransactions();
  const entries: BexioManualEntryInput[] = [];
  const created: BexioExpenseInput[] = [];
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
    listExpenses: async () => [],
    createExpense: async (input) => {
      created.push(input);
      return "exp-uuid-1";
    },
    attachFilesToExpense: async () => {},
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
  );
  return { useCases, expenses, txs, entries, created };
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

    const [swisscom, ubs] = [...expenses.rows.values()];
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
    const first = [...expenses.rows.values()][0];
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
    const first = [...expenses.rows.values()][0];
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
    const first = [...expenses.rows.values()][0];
    await expect(useCases.book(first.id, null)).rejects.toThrow(InvalidStateError);
  });

  it("une transaction ne sert qu'une pièce", async () => {
    const { useCases, expenses, txs } = setup({ f1: extraction(), f2: extraction() });
    txs.rows.push(transaction());
    await useCases.importInbox();
    await useCases.extractPending();
    const [a, b] = [...expenses.rows.values()];
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
    const first = [...expenses.rows.values()][0];
    expect(first.transactionId).toBeNull();
    const matched = await useCases.match(first.id, "tx-1");
    expect(matched.expense.transactionId).toBe("tx-1");
    const detached = await useCases.match(first.id, null);
    expect(detached.expense.transactionId).toBeNull();
    expect(txs.rows[0].expenseId).toBeNull();
  });
});
