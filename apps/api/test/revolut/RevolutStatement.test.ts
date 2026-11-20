import { describe, expect, it } from "vitest";
import { PaymentAccountKindDTO } from "@repo/models";
import {
  parseAmount,
  parseCsv,
  parseDate,
  parseRevolutStatement,
} from "@/revolut/domain/RevolutStatement.js";
import { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { revolut, ubs } from "../expense/fixtures.js";

/** Export Revolut Business réel (colonnes et formats), données fictives. */
const HEADER =
  "Date started (UTC),Date completed (UTC),ID,Type,State,Description,Reference,Payer,Card number,Card label,Card state,Orig currency,Orig amount,Payment currency,Amount,Total amount,Exchange rate,Fee,Fee currency,Balance,Account,International account number,Beneficiary account number,Beneficiary sort code or routing number,Beneficiary IBAN,Beneficiary BIC,Beneficiary name,MCC,Related transaction id,Spend program,Sender account,Sender name,Card references";
const STATEMENT = [
  HEADER,
  "2026-11-08,2026-11-09,aaaa0001-0000-0000-0000-000000000001,CARD_PAYMENT,COMPLETED,Hetzner Online Gmbh,,Jean Test,516760******4821,Abo Internet,ACTIVE,EUR,11.57,CHF,-10.59,-10.70,1.093178,-0.11,CHF,210.48,CHF Main,LT000000000000000000,,,,,,4816,,,,,",
  "2026-11-02,2026-11-02,aaaa0002-0000-0000-0000-000000000002,FEE,COMPLETED,Frais Revolut Business,Frais d'abonnement Basic,,,,,CHF,10.00,CHF,-10.00,-10.00,,0.00,CHF,221.18,CHF Main,LT000000000000000000,,,,,,,,,,,",
  '2026-10-27,2026-10-28,aaaa0003-0000-0000-0000-000000000003,CARD_PAYMENT,COMPLETED,"Github, Inc.",,Jean Test,516760******4821,Abo Internet,ACTIVE,USD,39.00,CHF,-32.32,-32.32,1.206865,0.00,CHF,249.24,CHF Main,LT000000000000000000,,,,,,7372,,,,,',
  "2026-10-20,2026-10-21,aaaa0004-0000-0000-0000-000000000004,CARD_REFUND,COMPLETED,Shell,,Jean Test,516760******4821,Abo Internet,ACTIVE,CHF,5.00,CHF,5.00,5.00,,0.00,CHF,281.56,CHF Main,LT000000000000000000,,,,,,5541,,,,,",
  "2026-10-19,,aaaa0005-0000-0000-0000-000000000005,CARD_PAYMENT,PENDING,Migros,,Jean Test,516760******4821,Abo Internet,ACTIVE,CHF,42.50,CHF,-42.50,-42.50,,0.00,CHF,276.56,CHF Main,LT000000000000000000,,,,,,5411,,,,,",
].join("\n");

describe("parseRevolutStatement", () => {
  it("lit l'export Revolut Business", () => {
    const { rows, errors } = parseRevolutStatement(`﻿${STATEMENT}\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      revolutId: "aaaa0001-0000-0000-0000-000000000001",
      legId: "CHF Main",
      revolutAccountId: "CHF Main",
      type: "card_payment",
      state: "completed",
      merchantName: "Hetzner Online Gmbh",
      mcc: "4816",
      amount: -10.7,
      currency: "CHF",
      billAmount: -11.57,
      billCurrency: "EUR",
      cardLast4: "4821",
      requiresReceipt: true,
    });
    expect(rows[0].occurredAt.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(rows[2].merchantName).toBe("Github, Inc.");
    expect(rows[1]).toMatchObject({ type: "fee", requiresReceipt: false, merchantName: null });
    expect(rows[3]).toMatchObject({ type: "card_refund", requiresReceipt: false, amount: 5 });
    expect(rows[4]).toMatchObject({ state: "pending", requiresReceipt: true });
    expect(rows[4].occurredAt.toISOString().slice(0, 10)).toBe("2026-10-19");
  });

  it("point-virgule, en-têtes français, sans ID", () => {
    const csv = [
      "Date de fin (UTC);Type;État;Description;Numéro de carte;Devise de paiement;Montant;Compte",
      "02.11.2026;Paiement par carte;Terminé;Coop;************1234;CHF;-12,50;CHF Main",
    ].join("\r\n");
    const { rows, errors } = parseRevolutStatement(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      type: "card_payment",
      state: "completed",
      amount: -12.5,
      cardLast4: "1234",
    });
    expect(rows[0].revolutId).toMatch(/^csv-/);
    expect(parseRevolutStatement(csv).rows[0].revolutId).toBe(rows[0].revolutId);
  });

  it("signale les colonnes et lignes illisibles", () => {
    expect(parseRevolutStatement("a,b\n1,2").errors[0]).toMatch(/colonnes introuvables/);
    const { rows, errors } = parseRevolutStatement(
      `${HEADER}\n2026-11-01,2026-11-01,x,CARD_PAYMENT,COMPLETED,X,,,,,,CHF,1,CHF,abc,abc,,,,,CHF Main`,
    );
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/ligne 2 : montant illisible/);
  });
});

describe("formats", () => {
  it.each([
    ["-10.70", -10.7],
    ["1,234.50", 1234.5],
    ["1'234.50", 1234.5],
    ["-1 234,50", -1234.5],
    ["12,5", 12.5],
    ["1,234", 1234],
    ["(12.00)", -12],
    ["", null],
  ])("parseAmount(%s)", (value, expected) => {
    expect(parseAmount(value)).toBe(expected);
  });

  it("parseDate", () => {
    expect(parseDate("2026-11-09 14:03:22")?.toISOString()).toBe("2026-11-09T14:03:22.000Z");
    expect(parseDate("09/11/2026")?.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(parseDate("")).toBeNull();
  });

  it("parseCsv : guillemets et retours à la ligne cités", () => {
    expect(parseCsv('a,b\n"x, ""y""","l1\nl2"\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "l1\nl2"],
    ]);
  });
});

describe("RevolutUseCases.importStatement", () => {
  function setup(accounts = [revolut, ubs]) {
    const stored: { paymentAccountId: string | null; revolutId: string }[] = [];
    const repo = {
      upsertMany: async (rows: typeof stored) => {
        stored.push(...rows);
        return { created: rows.length, updated: 0 };
      },
    } as unknown as IRevolutTransactionRepository;
    const saved: typeof accounts = [];
    const settings = {
      listPaymentAccounts: async () => accounts.map((a) => ({ ...a, expenseCount: 0 })),
      savePaymentAccount: async (a: (typeof accounts)[number]) => void saved.push(a),
    } as unknown as ISettingsRepository;
    return { useCases: new RevolutUseCases(repo, settings), stored, saved };
  }

  it("rattache au seul compte Revolut et rend la période", async () => {
    const { useCases, stored } = setup([{ ...revolut, revolutAccountId: null }, ubs]);
    const result = await useCases.importStatement(STATEMENT, null);
    expect(result).toMatchObject({
      rows: 5,
      created: 5,
      errors: [],
      from: "2026-10-19",
      to: "2026-11-09",
    });
    expect(new Set(stored.map((r) => r.paymentAccountId))).toEqual(new Set([revolut.id]));
  });

  it("par le nom du compte Revolut (« CHF Main »)", async () => {
    const second = {
      ...revolut,
      id: "acc-rev-eur",
      name: "Revolut EUR",
      revolutAccountId: "EUR Main",
      cards: [],
    };
    const { useCases, stored } = setup([
      { ...revolut, revolutAccountId: "chf main" },
      second,
      { ...ubs, kind: PaymentAccountKindDTO.UBS },
    ]);
    await useCases.importStatement(STATEMENT, null);
    expect(stored.every((r) => r.paymentAccountId === revolut.id)).toBe(true);
  });

  it("ajoute au compte Revolut les cartes inconnues du relevé", async () => {
    const { useCases, saved } = setup([{ ...revolut, cards: [] }, ubs]);
    const result = await useCases.importStatement(STATEMENT, null);
    expect(result.cardsAdded).toEqual(["516760******4821 (Abo Internet)"]);
    expect(saved[0].cards).toMatchObject([
      { last4: "4821", maskedNumber: "516760******4821", label: "Abo Internet" },
    ]);
    // Déjà connue : rien.
    const again = setup();
    expect((await again.useCases.importStatement(STATEMENT, null)).cardsAdded).toEqual([]);
  });

  it("fichier illisible : 400", async () => {
    const { useCases } = setup();
    await expect(useCases.importStatement("nimporte,quoi\n1,2", null)).rejects.toThrow(
      /colonnes introuvables/,
    );
  });
});
