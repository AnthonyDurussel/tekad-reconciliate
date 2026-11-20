import { describe, expect, it } from "vitest";
import { ConflictError } from "@/shared/domain/errors.js";
import {
  BexioHttpGateway,
  createBexioGateway,
} from "@/bexio/infrastructure/BexioHttpGateway.js";

type Call = { url: string; method: string; body: unknown };

function fake(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://api.bexio.com/", "");
    calls.push({
      url: path,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
    });
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]));
  }) as typeof fetch;
  return { calls, impl };
}

describe("BexioHttpGateway", () => {
  it("inbox : fichiers non archivés, extension ajoutée", async () => {
    const { impl } = fake({
      "3.0/files": [
        { id: 1, name: "ticket", extension: "jpg", mime_type: "image/jpeg", is_archived: false },
        { id: 2, name: "old.pdf", extension: "pdf", is_archived: true },
      ],
    });
    const files = await new BexioHttpGateway("t", undefined, impl).listInboxFiles();
    expect(files).toEqual([
      { id: "1", uuid: null, name: "ticket.jpg", mimeType: "image/jpeg", createdAt: null },
    ]);
  });

  it("écriture : numéros de compte → ids, CHF, TVA sur le compte de charge, pièce jointe", async () => {
    const { calls, impl } = fake({
      "2.0/accounts": [
        { id: 10, account_no: "6510", name: "Télécom" },
        { id: 20, account_no: "1021", name: "Revolut" },
      ],
      "3.0/currencies": [{ id: 1, name: "CHF" }],
      "3.0/accounting/manual_entries/77/entries/88/files": {},
      "3.0/accounting/manual_entries": { id: 77, entries: [{ id: 88 }] },
    });
    const id = await new BexioHttpGateway("t", undefined, impl).createManualEntry({
      date: "2026-11-02",
      reference: "swisscom.pdf",
      description: "Swisscom — Télécom",
      amountChf: 89.9,
      debitAccountNo: "6510",
      creditAccountNo: "1021",
      taxId: 12,
      attachment: { fileName: "s.pdf", mimeType: "application/pdf", data: Buffer.from("x") },
    });
    expect(id).toBe("77");
    const post = calls.find((c) => c.url === "3.0/accounting/manual_entries");
    expect(post?.body).toMatchObject({
      type: "manual_single_entry",
      date: "2026-11-02",
      entries: [
        {
          debit_account_id: 10,
          credit_account_id: 20,
          tax_id: 12,
          tax_account_id: 10,
          amount: 89.9,
          currency_id: 1,
        },
      ],
    });
    expect(calls.some((c) => c.url.endsWith("/entries/88/files") && c.method === "POST")).toBe(true);
  });

  it("compte inconnu dans bexio : 409", async () => {
    const { impl } = fake({ "2.0/accounts": [], "3.0/currencies": [{ id: 1, name: "CHF" }] });
    await expect(
      new BexioHttpGateway("t", undefined, impl).createManualEntry({
        date: "2026-11-02",
        reference: "x",
        description: "x",
        amountChf: 1,
        debitAccountNo: "6510",
        creditAccountNo: "1021",
        taxId: null,
        attachment: null,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("plan comptable et codes TVA", async () => {
    const { impl } = fake({
      "2.0/accounts": [
        { id: 2, account_no: 6510, name: "Téléphone", account_type: 2, tax_id: 7, is_active: true },
        { id: 1, account_no: "1020", name: "UBS", account_type: 3, is_active: true },
        { id: 3, account_no: "9999", name: "?", account_type: 9, is_active: false },
      ],
      "3.0/taxes": [{ id: 7, name: "VB81", display_name: "VB81 - 8.1%", value: "8.1", type: "pre_tax", is_active: true }],
    });
    const gateway = new BexioHttpGateway("t", undefined, impl);
    expect(await gateway.listAccounts()).toEqual([
      { id: 1, accountNo: "1020", name: "UBS", type: "ASSET", taxId: null, active: true },
      { id: 2, accountNo: "6510", name: "Téléphone", type: "EXPENSE", taxId: 7, active: true },
      { id: 3, accountNo: "9999", name: "?", type: "OTHER", taxId: null, active: false },
    ]);
    expect(await gateway.listTaxes()).toEqual([
      { id: 7, code: "VB81", label: "VB81 - 8.1%", rate: 8.1, type: "pre_tax", active: true },
    ]);
  });

  it("dépenses : pages, création + DONE, pièce jointe sans perdre les autres", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    const impl = (async (url: string, init: RequestInit = {}) => {
      const path = url.replace("https://api.bexio.com/", "");
      calls.push({ url: path, method: init.method ?? "GET", body: typeof init.body === "string" ? JSON.parse(init.body) : undefined });
      if (path.startsWith("4.0/expenses?")) {
        const page = Number(/page=(\d+)/.exec(path)![1]);
        return new Response(JSON.stringify({
          data: [{ id: `e${page}`, document_no: `AU-${page}`, status: "DONE", lastname_company: "Swisscom", paid_on: "2026-11-02", gross: "89.90", currency_code: "CHF", bank_account_id: 5, attachment_ids: [] }],
          paging: { page, page_count: 2 },
        }));
      }
      if (path === "4.0/expenses" && init.method === "POST") return new Response(JSON.stringify({ id: "new-uuid" }));
      if (path === "4.0/expenses/e1" && !init.method) {
        return new Response(JSON.stringify({ id: "e1", document_no: "AU-1", paid_on: "2026-11-02", currency_code: "CHF", amount: 89.9, gross: 89.9, bank_account_id: 5, booking_account_id: 10, attachment_ids: ["a"] }));
      }
      return new Response("{}");
    }) as typeof fetch;
    const g = new BexioHttpGateway("t", undefined, impl);
    const list = await g.listExpenses();
    expect(list.map((e) => [e.id, e.vendor, e.gross])).toEqual([["e1", "Swisscom", 89.9], ["e2", "Swisscom", 89.9]]);
    expect(await g.createExpense({ paidOn: "2026-11-02", title: "Swisscom", amountChf: 89.9, bankAccountId: 5, bookingAccountId: 10, taxId: 12, attachmentIds: ["u1"] })).toBe("new-uuid");
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ paid_on: "2026-11-02", amount: 89.9, currency_code: "CHF", bank_account_id: 5, booking_account_id: 10, tax_id: 12, attachment_ids: ["u1"] });
    expect(calls.some((c) => c.url === "4.0/expenses/new-uuid/bookings/DONE" && c.method === "PUT")).toBe(true);
    await g.attachFilesToExpense("e1", ["b"]);
    expect(calls.find((c) => c.url === "4.0/expenses/e1" && c.method === "PUT")?.body).toMatchObject({ attachment_ids: ["a", "b"], amount: 89.9, booking_account_id: 10 });
  });

  it("sans jeton : non configuré", () => {
    expect(createBexioGateway({}).configured).toBe(false);
  });
});
