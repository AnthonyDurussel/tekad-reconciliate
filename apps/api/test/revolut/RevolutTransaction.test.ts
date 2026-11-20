import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { fromRevolutApi } from "@/revolut/domain/RevolutTransaction.js";
import {
  clientAssertion,
  RevolutBusinessGateway,
} from "@/revolut/infrastructure/RevolutBusinessGateway.js";

describe("fromRevolutApi", () => {
  it("une ligne par jambe, carte et montant facturé", () => {
    const rows = fromRevolutApi({
      id: "t1",
      type: "card_payment",
      state: "completed",
      created_at: "2026-11-02T09:00:00Z",
      completed_at: "2026-11-03T09:00:00Z",
      merchant: { name: "Google", city: "Dublin", category_code: "5818", country: "IE" },
      card: { card_number: "459876******4821" },
      legs: [
        {
          leg_id: "l1",
          account_id: "acc",
          amount: -23.4,
          currency: "CHF",
          bill_amount: 24,
          bill_currency: "EUR",
          description: "Google Workspace",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      revolutId: "t1",
      legId: "l1",
      cardLast4: "4821",
      mcc: "5818",
      amount: -23.4,
      billAmount: 24,
      billCurrency: "EUR",
      requiresReceipt: true,
    });
    expect(rows[0].occurredAt.toISOString()).toBe("2026-11-03T09:00:00.000Z");
  });

  it("change entre comptes : pas de pièce", () => {
    const rows = fromRevolutApi({
      id: "t2",
      type: "exchange",
      state: "completed",
      created_at: "2026-11-02T09:00:00Z",
      legs: [
        { leg_id: "a", account_id: "chf", amount: -100, currency: "CHF" },
        { leg_id: "b", account_id: "eur", amount: 103, currency: "EUR" },
      ],
    });
    expect(rows.map((r) => r.requiresReceipt)).toEqual([false, false]);
  });
});

describe("RevolutBusinessGateway", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("assertion client RS256 vérifiable", () => {
    const jwt = clientAssertion({ clientId: "cid", privateKey: pem, issuer: "tekad.ch" }, 0);
    const [h, p, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({
      iss: "tekad.ch",
      sub: "cid",
      aud: "https://revolut.com",
      exp: 300,
    });
    const verify = createVerify("RSA-SHA256");
    verify.update(`${h}.${p}`);
    expect(verify.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });

  it("jeton puis pages de transactions jusqu'à épuisement", async () => {
    const calls: string[] = [];
    const page = (n: number, start: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `t${start + i}`,
        type: "card_payment",
        state: "completed",
        created_at: new Date(Date.UTC(2026, 10, 20) - (start + i) * 60_000).toISOString(),
        legs: [],
      }));
    const fakeFetch = (async (url: string) => {
      calls.push(url.split("?")[0]);
      if (url.endsWith("/auth/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 2400 }));
      }
      const transactions = calls.filter((c) => c.endsWith("/transactions")).length;
      return new Response(
        JSON.stringify(transactions === 1 ? page(1000, 0) : page(5, 1000)),
      );
    }) as typeof fetch;
    const gateway = new RevolutBusinessGateway(
      { apiUrl: "https://x/api/1.0", clientId: "c", privateKey: pem, issuer: "i", refreshToken: "r" },
      fakeFetch,
    );
    const txs = await gateway.listTransactions(new Date("2026-01-01"), new Date("2026-11-21"));
    expect(txs).toHaveLength(1005);
    expect(calls).toEqual([
      "https://x/api/1.0/auth/token",
      "https://x/api/1.0/transactions",
      "https://x/api/1.0/transactions",
    ]);
  });
});
