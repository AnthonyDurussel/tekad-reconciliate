import { describe, expect, it } from "vitest";
import {
  BexioAccountTypeDTO,
  type BexioAccountDTO,
  type BexioTaxDTO,
} from "@repo/models";
import {
  EXPENSE_ACCOUNT_TYPES,
  PAYMENT_ACCOUNT_TYPES,
  bexioAccountOptions,
  bexioTaxOptions,
  readCardNumber,
} from "./bexioOptions";

const account = (
  id: number,
  accountNo: string,
  name: string,
  type: BexioAccountTypeDTO,
  active = true,
): BexioAccountDTO => ({ id, accountNo, name, type, taxId: null, active });

const ACCOUNTS: BexioAccountDTO[] = [
  account(1, "6570", "Informatique", BexioAccountTypeDTO.EXPENSE),
  account(2, "1021", "Revolut", BexioAccountTypeDTO.ASSET),
  account(3, "6500", "Frais de bureau", BexioAccountTypeDTO.EXPENSE),
  account(4, "2210", "CC Anthony", BexioAccountTypeDTO.LIABILITY),
  account(5, "6640", "Frais de voyage", BexioAccountTypeDTO.EXPENSE, false),
  account(6, "3200", "Ventes", BexioAccountTypeDTO.EARNING),
  account(7, "10200", "UBS", BexioAccountTypeDTO.ASSET),
];

describe("bexioAccountOptions", () => {
  it("keeps the active accounts of the requested types, sorted by number", () => {
    expect(bexioAccountOptions(ACCOUNTS, EXPENSE_ACCOUNT_TYPES)).toEqual([
      { value: "6500", label: "6500 — Frais de bureau" },
      { value: "6570", label: "6570 — Informatique" },
    ]);
    expect(
      bexioAccountOptions(ACCOUNTS, PAYMENT_ACCOUNT_TYPES).map((o) => o.value),
    ).toEqual(["1021", "2210", "10200"]);
  });

  it("keeps an inactive account when it is the current value", () => {
    expect(
      bexioAccountOptions(ACCOUNTS, EXPENSE_ACCOUNT_TYPES, "6640").map(
        (o) => o.value,
      ),
    ).toEqual(["6500", "6570", "6640"]);
  });

  it("keeps a current value unknown to bexio, labelled", () => {
    const options = bexioAccountOptions(
      ACCOUNTS,
      EXPENSE_ACCOUNT_TYPES,
      "6999",
      (no) => `${no} (inconnu)`,
    );
    expect(options[0]).toEqual({ value: "6999", label: "6999 (inconnu)" });
  });

  it("drops duplicated numbers", () => {
    const options = bexioAccountOptions(
      [...ACCOUNTS, account(8, "6570", "Doublon", BexioAccountTypeDTO.EXPENSE)],
      EXPENSE_ACCOUNT_TYPES,
    );
    expect(options.filter((o) => o.value === "6570")).toHaveLength(1);
  });
});

describe("bexioTaxOptions", () => {
  const tax = (
    id: number,
    code: string,
    rate: number | null,
    type: string,
    active = true,
  ): BexioTaxDTO => ({ id, code, label: code, rate, type, active });
  const groups = { preTax: "Préalable", other: "Autres" };

  it("puts the input VAT first, without inactive codes", () => {
    const options = bexioTaxOptions(
      [
        tax(1, "UN81", 8.1, "sales_tax"),
        tax(2, "VB81", 8.1, "pre_tax"),
        tax(3, "VB26", 2.6, "pre_tax"),
        tax(4, "VB77", 7.7, "pre_tax", false),
      ],
      null,
      groups,
    );
    expect(options).toEqual([
      {
        group: "Préalable",
        items: [
          { value: "3", label: "VB26 (2.6 %)" },
          { value: "2", label: "VB81 (8.1 %)" },
        ],
      },
      { group: "Autres", items: [{ value: "1", label: "UN81 (8.1 %)" }] },
    ]);
  });

  it("keeps the current code even when inactive or unknown", () => {
    const inactive = bexioTaxOptions(
      [tax(4, "VB77", 7.7, "pre_tax", false)],
      4,
      groups,
    );
    expect(inactive[0].items.map((o) => o.value)).toEqual(["4"]);
    const unknown = bexioTaxOptions([], 99, groups);
    expect(unknown).toEqual([
      { group: "Autres", items: [{ value: "99", label: "99" }] },
    ]);
  });
});

describe("readCardNumber", () => {
  it("reads a full, spaced number into its masked form", () => {
    expect(readCardNumber("5167 6012 3456 4721")).toEqual({
      empty: false,
      valid: true,
      last4: "4721",
      masked: "516760******4721",
    });
  });

  it("reads a masked number", () => {
    expect(readCardNumber("5167 60** **** 4721").masked).toBe(
      "516760******4721",
    );
    expect(readCardNumber("**** 4721").last4).toBe("4721");
  });

  it("refuses a number that does not end with 4 digits", () => {
    expect(readCardNumber("5167 60** **** 472")).toMatchObject({
      empty: false,
      valid: false,
    });
    expect(readCardNumber("abcd4721").valid).toBe(false);
    expect(readCardNumber("  ").empty).toBe(true);
  });
});
