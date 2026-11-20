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
      { id: "1", name: "ticket.jpg", mimeType: "image/jpeg", createdAt: null },
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

  it("sans jeton : non configuré", () => {
    expect(createBexioGateway({}).configured).toBe(false);
  });
});
