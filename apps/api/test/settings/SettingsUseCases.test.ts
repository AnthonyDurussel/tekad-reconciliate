import { describe, expect, it } from "vitest";
import {
  BexioAccountTypeDTO,
  PaymentAccountKindDTO,
  type BexioAccountDTO,
} from "@repo/models";
import { ValidationError } from "@/shared/domain/errors.js";
import { SettingsUseCases } from "@/settings/application/usecases/SettingsUseCases.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import type { IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";

const account = (
  id: number,
  accountNo: string,
  name: string,
  type: BexioAccountTypeDTO,
  over: Partial<BexioAccountDTO> = {},
): BexioAccountDTO => ({ id, accountNo, name, type, taxId: null, active: true, ...over });

const CHART = [
  account(1, "1020", "UBS", BexioAccountTypeDTO.ASSET),
  account(2, "1021", "Revolut", BexioAccountTypeDTO.ASSET),
  account(3, "2210", "Compte courant Anthony", BexioAccountTypeDTO.LIABILITY),
  account(10, "6510", "Téléphone, internet", BexioAccountTypeDTO.EXPENSE, { taxId: 7 }),
  account(11, "6570", "Informatique", BexioAccountTypeDTO.EXPENSE),
  account(12, "6999", "Ancien compte", BexioAccountTypeDTO.EXPENSE, { active: false }),
  account(20, "3200", "Ventes", BexioAccountTypeDTO.EARNING),
];

function setup(configured = true) {
  const categories = new Map<string, ExpenseCategoryProps>();
  const accounts = new Map<string, PaymentAccountProps>();
  const repo = {
    listCategories: async () => [...categories.values()].map((c) => ({ ...c, expenseCount: 0 })),
    findCategory: async (id: string) => categories.get(id) ?? null,
    saveCategory: async (c: ExpenseCategoryProps) => void categories.set(c.id, { ...c }),
    listPaymentAccounts: async () => [...accounts.values()].map((a) => ({ ...a, expenseCount: 0 })),
    findPaymentAccount: async (id: string) => accounts.get(id) ?? null,
    savePaymentAccount: async (a: PaymentAccountProps) => void accounts.set(a.id, { ...a }),
  } as unknown as ISettingsRepository;
  const bexio = {
    configured,
    listAccounts: async () => CHART,
    listTaxes: async () => [
      { id: 7, code: "VB81", label: "VB81 8.1%", rate: 8.1, type: "pre_tax", active: true },
    ],
  } as unknown as IBexioGateway;
  return { useCases: new SettingsUseCases(repo, bexio), categories, accounts };
}

describe("SettingsUseCases — plan comptable bexio", () => {
  it("un type de dépense par compte de charge actif, règles par défaut", async () => {
    const { useCases, categories } = setup();
    expect(await useCases.syncCategoriesFromBexio()).toEqual({
      accounts: 2,
      created: 2,
      updated: 0,
      deactivated: 0,
    });
    const tel = [...categories.values()].find((c) => c.code === "6510")!;
    expect(tel).toMatchObject({
      bexioAccountId: 10,
      label: "Téléphone, internet",
      bexioAccountNo: "6510",
      bexioTaxId: 7,
      vatRate: 8.1,
      active: true,
    });
    expect(tel.keywords).toContain("swisscom");
    // Deuxième passage : rien ne change.
    expect(await useCases.syncCategoriesFromBexio()).toMatchObject({ created: 0, updated: 0 });
  });

  it("garde les règles saisies, suit le nom bexio, désactive un compte disparu", async () => {
    const { useCases, categories } = setup();
    await useCases.syncCategoriesFromBexio();
    const it = [...categories.values()].find((c) => c.code === "6570")!;
    categories.set(it.id, { ...it, keywords: ["mon-fournisseur"], label: "Ancien nom" });
    categories.set("gone", { ...it, id: "gone", bexioAccountId: 999, code: "6888" });
    const result = await useCases.syncCategoriesFromBexio();
    expect(result).toMatchObject({ updated: 1, deactivated: 1 });
    expect(categories.get(it.id)).toMatchObject({ label: "Informatique", keywords: ["mon-fournisseur"] });
    expect(categories.get("gone")?.active).toBe(false);
  });

  it("refuse un compte absent du plan ou du mauvais genre", async () => {
    const { useCases } = setup();
    await expect(
      useCases.createCategory({ code: "X", label: "X", bexioAccountNo: "1020" }),
    ).rejects.toThrow(/compte de charge/);
    await expect(
      useCases.createPaymentAccount({ kind: PaymentAccountKindDTO.UBS, name: "UBS", bexioAccountNo: "6510" }),
    ).rejects.toThrow(/trésorerie ou de passif/);
    await expect(
      useCases.createPaymentAccount({ kind: PaymentAccountKindDTO.UBS, name: "UBS", bexioAccountNo: "1099" }),
    ).rejects.toThrow(ValidationError);
    const cat = await useCases.createCategory({ code: "6570", label: "IT", bexioAccountNo: "6570" });
    expect(cat.bexioAccountId).toBe(11);
  });

  it("sans bexio : numéro pris tel quel, synchronisation refusée", async () => {
    const { useCases } = setup(false);
    await expect(useCases.syncCategoriesFromBexio()).rejects.toThrow(/pas configuré/);
    const cat = await useCases.createCategory({ code: "6570", label: "IT", bexioAccountNo: "6570" });
    expect(cat.bexioAccountId).toBeNull();
  });

  it("carte saisie en entier : seuls la forme masquée et les 4 derniers chiffres restent", async () => {
    const { useCases, accounts } = setup();
    const a = await useCases.createPaymentAccount({
      kind: PaymentAccountKindDTO.REVOLUT,
      name: "Revolut",
      bexioAccountNo: "1021",
      cards: [{ number: "5167 6012 3456 4721", last4: "4721", label: "Abo Internet" }],
    });
    expect(a.cards[0]).toMatchObject({ last4: "4721", maskedNumber: "516760******4721" });
    expect(JSON.stringify([...accounts.values()])).not.toContain("51676012");
    await expect(
      useCases.createPaymentAccount({
        kind: PaymentAccountKindDTO.REVOLUT,
        name: "Revolut 2",
        cards: [{ number: "5167 6012 3456 4721", last4: "1111" }],
      }),
    ).rejects.toThrow(/4 chiffres/);
  });
});
