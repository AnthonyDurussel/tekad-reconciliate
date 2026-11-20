import { describe, expect, it } from "vitest";
import {
  BexioAccountTypeDTO,
  BexioExpenseIssueDTO,
  ExpenseStatusDTO,
  ReconciliationModeDTO,
} from "@repo/models";
import { checkBexioExpense } from "@/bexio-expense/domain/BexioExpenseCheck.js";
import { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import type {
  IBexioExpenseRepository,
  StoredBexioExpense,
} from "@/bexio-expense/application/IBexioExpenseRepository.js";
import type { BexioExpense, IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";
import type { IExpenseRepository } from "@/expense/application/repositories/IExpenseRepository.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import { Expense } from "@/expense/domain/Expense.js";
import { accounts, categories, extraction } from "../expense/fixtures.js";

const base = {
  status: "DONE",
  attachmentCount: 1,
  hasLinkedReceipt: false,
  hasBankAccount: true,
  reconciliation: ReconciliationModeDTO.BEXIO,
  bexioReconciled: true,
  statementMatched: false,
};

describe("checkBexioExpense", () => {
  it("pièce + rapprochée dans bexio : rien à signaler", () => {
    expect(checkBexioExpense(base)).toEqual({ reconciled: true, issues: [] });
  });
  it("sans pièce, pas rapprochée dans bexio", () => {
    expect(checkBexioExpense({ ...base, attachmentCount: 0, bexioReconciled: false }).issues).toEqual([
      BexioExpenseIssueDTO.MISSING_RECEIPT,
      BexioExpenseIssueDTO.NOT_RECONCILED,
    ]);
  });
  it("compte importé : la transaction du relevé rapprochée de sa pièce", () => {
    const imported = { ...base, reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT, bexioReconciled: false };
    expect(checkBexioExpense(imported).issues).toEqual([BexioExpenseIssueDTO.NOT_RECONCILED]);
    expect(checkBexioExpense({ ...imported, statementMatched: true })).toEqual({ reconciled: true, issues: [] });
  });
  it("sans relevé : pas de rapprochement exigé ; compte inconnu signalé ; brouillon", () => {
    expect(checkBexioExpense({ ...base, reconciliation: ReconciliationModeDTO.NONE, bexioReconciled: false }))
      .toEqual({ reconciled: null, issues: [] });
    expect(checkBexioExpense({ ...base, reconciliation: null }).issues).toEqual([BexioExpenseIssueDTO.UNKNOWN_ACCOUNT]);
    expect(checkBexioExpense({ ...base, status: "DRAFT" }).issues).toContain(BexioExpenseIssueDTO.DRAFT);
  });
});

const bexioExpense = (over: Partial<BexioExpense> = {}): BexioExpense => ({
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
  attachmentIds: ["uuid-f1"],
  ...over,
});

function setup(list: BexioExpense[]) {
  const stored = new Map<string, StoredBexioExpense>();
  const repo: IBexioExpenseRepository = {
    replaceAll: async (rows) => {
      const prev = new Map(stored);
      stored.clear();
      for (const r of rows)
        stored.set(r.id, { ...r, paymentAccountId: prev.get(r.id)?.paymentAccountId ?? null, syncedAt: new Date() });
    },
    list: async () => [...stored.values()],
    find: async (id) => stored.get(id) ?? null,
    setAttachments: async (id, ids) => void (stored.get(id)!.attachmentIds = ids),
    setPaymentAccount: async (id, pid) => void (stored.get(id)!.paymentAccountId = pid),
  };
  const attached: [string, string[]][] = [];
  const bexio = {
    configured: true,
    listExpenses: async () => list,
    listAccounts: async () => [
      { id: 2, accountNo: "1021", name: "Revolut", type: BexioAccountTypeDTO.ASSET, taxId: null, active: true },
      { id: 1, accountNo: "1020", name: "UBS", type: BexioAccountTypeDTO.ASSET, taxId: null, active: true },
      { id: 10, accountNo: "6510", name: "Télécom", type: BexioAccountTypeDTO.EXPENSE, taxId: null, active: true },
    ],
    listBankAccounts: async () => [
      { id: 5, name: "Revolut", accountId: 2, iban: null },
      { id: 6, name: "UBS", accountId: 1, iban: null },
    ],
    fileUuid: async (id: string) => `uuid-${id}`,
    findFileByUuid: async (uuid: string) =>
      uuid === "missing" ? null : { id: `id-${uuid}`, name: `${uuid}.pdf`, mimeType: "application/pdf" },
    downloadFile: async (id: string) => ({ fileName: "x", mimeType: "application/pdf", data: Buffer.from(id) }),
    attachFilesToExpense: async (id: string, uuids: string[]) => void attached.push([id, uuids]),
  } as unknown as IBexioGateway;
  const pieces = new Map<string, Expense>();
  const piece = (id: string, fileId: string, uuid: string | null) => {
    const e = Expense.importFromInbox({ id, bexioFileId: fileId, bexioFileUuid: uuid, fileName: `${fileId}.pdf`, mimeType: null });
    e.applyExtraction(extraction(), { accounts, categories, transaction: null });
    pieces.set(id, e);
    return e;
  };
  const expenses = {
    list: async () => [...pieces.values()],
    findById: async (id: string) => pieces.get(id) ?? null,
    findByFileUuids: async (u: string[]) => [...pieces.values()].filter((e) => u.includes(e.snapshot.bexioFileUuid ?? "")),
    findByBexioExpenseIds: async (ids: string[]) =>
      [...pieces.values()].filter((e) => ids.includes(e.snapshot.bexioExpenseId ?? "")),
    save: async (e: Expense) => void pieces.set(e.id, e),
  } as unknown as IExpenseRepository;
  const accountRows = new Map(accounts.map((a) => [a.id, { ...a }]));
  const settings = {
    listPaymentAccounts: async () => [...accountRows.values()].map((a) => ({ ...a, expenseCount: 0 })),
    findPaymentAccount: async (id: string) => accountRows.get(id) ?? null,
    savePaymentAccount: async (a: (typeof accounts)[number]) => void accountRows.set(a.id, { ...a }),
    listCategories: async () => categories.map((c) => ({ ...c, expenseCount: 0 })),
  } as unknown as ISettingsRepository;
  const txs = { findByExpense: async () => null } as unknown as IRevolutTransactionRepository;
  return {
    useCases: new BexioExpenseUseCases(repo, bexio, expenses, settings, txs),
    accountRows,
    piece,
    pieces,
    attached,
  };
}

describe("BexioExpenseUseCases", () => {
  it("synchronise, résout les comptes, lie la pièce dont le fichier est joint", async () => {
    const s = setup([
      bexioExpense(),
      bexioExpense({ id: "22222222-2222-4222-8222-222222222222", documentNo: "AU-2", bankAccountId: 6, attachmentIds: [], transactionId: null }),
    ]);
    s.piece("p1", "f1", "uuid-f1");
    expect(await s.useCases.sync()).toBe(1);
    expect(s.pieces.get("p1")!.snapshot.bexioExpenseId).toBe("11111111-1111-4111-8111-111111111111");
    expect(s.pieces.get("p1")!.status).toBe(ExpenseStatusDTO.BOOKED);

    const list = await s.useCases.list({});
    const [au1, au2] = [list.find((d) => d.documentNo === "AU-1")!, list.find((d) => d.documentNo === "AU-2")!];
    // AU-1 : Revolut (compte importé), pièce liée mais sa transaction de relevé manque.
    expect(au1).toMatchObject({
      bookingAccountNo: "6510",
      paymentAccountName: "Revolut Business",
      reconciliation: "STATEMENT_IMPORT",
      expenseId: "p1",
      reconciled: false,
      issues: ["NOT_RECONCILED"],
    });
    // AU-2 : UBS (rapproché dans bexio), ni pièce ni rapprochement.
    expect(au2.issues).toEqual(["MISSING_RECEIPT", "NOT_RECONCILED"]);
    expect((await s.useCases.list({ issue: BexioExpenseIssueDTO.MISSING_RECEIPT })).map((d) => d.documentNo)).toEqual(["AU-2"]);
  });

  it("lier une pièce : fichier joint dans bexio, pièce comptabilisée ; une seule pièce par dépense", async () => {
    const s = setup([bexioExpense({ attachmentIds: [] })]);
    await s.useCases.sync();
    s.piece("p2", "f2", null);
    const dto = await s.useCases.link("11111111-1111-4111-8111-111111111111", "p2");
    expect(s.attached).toEqual([["11111111-1111-4111-8111-111111111111", ["uuid-f2"]]]);
    expect(dto).toMatchObject({ expenseId: "p2", attachmentCount: 1 });
    expect(s.pieces.get("p2")!.status).toBe(ExpenseStatusDTO.BOOKED);
    s.piece("p3", "f3", "uuid-f3");
    await expect(s.useCases.link("11111111-1111-4111-8111-111111111111", "p3")).rejects.toThrow(/déjà sa pièce/);
  });

  it("une dépense disparue de bexio délie sa pièce", async () => {
    const s = setup([bexioExpense()]);
    s.piece("p1", "f1", "uuid-f1");
    await s.useCases.sync();
    const gone = setup([]);
    gone.pieces.set("p1", s.pieces.get("p1")!);
    await gone.useCases.sync();
    expect(gone.pieces.get("p1")!.snapshot.bexioExpenseId).toBeNull();
    expect(gone.pieces.get("p1")!.status).not.toBe(ExpenseStatusDTO.BOOKED);
  });
});

describe("BexioExpenseUseCases — fiche et compte", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("fiche : fichiers joints nommés ; seul un fichier de la dépense se télécharge", async () => {
    const s = setup([bexioExpense({ attachmentIds: ["uuid-a"] })]);
    await s.useCases.sync();
    const detail = await s.useCases.get(ID);
    expect(detail.attachments).toEqual([{ uuid: "uuid-a", name: "uuid-a.pdf", mimeType: "application/pdf" }]);
    const file = await s.useCases.file(ID, "uuid-a");
    expect(file.data.toString()).toBe("id-uuid-a");
    expect(file.fileName).toBe("uuid-a.pdf");
    await expect(s.useCases.file(ID, "uuid-autre")).rejects.toThrow(/not found/);
  });

  it("compte inconnu → choisi sur la dépense, puis pour tout le compte bancaire bexio", async () => {
    const s = setup([
      bexioExpense({ bankAccountId: 9, attachmentIds: [] }),
      bexioExpense({ id: "22222222-2222-4222-8222-222222222222", documentNo: "AU-2", bankAccountId: 9 }),
    ]);
    await s.useCases.sync();
    let [one] = await s.useCases.list({ search: undefined });
    expect(one.issues).toContain("UNKNOWN_ACCOUNT");
    const manual = await s.useCases.setPaymentAccount(ID, "acc-cc");
    expect(manual).toMatchObject({ paymentAccountId: "acc-cc", paymentAccountSource: "MANUAL", reconciled: null });
    // Pour toutes les dépenses de ce compte bancaire : associé au compte UBS.
    const all = await s.useCases.setPaymentAccount(ID, "acc-ubs", true);
    expect(all).toMatchObject({ paymentAccountId: "acc-ubs", paymentAccountSource: "BANK_ACCOUNT" });
    expect(s.accountRows.get("acc-ubs")!.bexioBankAccountId).toBe(9);
    const list = await s.useCases.list({});
    expect(list.every((d) => d.paymentAccountId === "acc-ubs")).toBe(true);
    // Le choix survit à la synchronisation.
    await s.useCases.setPaymentAccount(ID, "acc-cc");
    await s.useCases.sync();
    [one] = (await s.useCases.list({})).filter((d) => d.id === ID);
    expect(one.paymentAccountId).toBe("acc-cc");
  });
});
