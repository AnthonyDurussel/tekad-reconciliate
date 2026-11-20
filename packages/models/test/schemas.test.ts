import { describe, expect, it } from "vitest";
import {
  createPaymentAccountSchema,
  PaymentAccountKindDTO,
  updateExpenseSchema,
} from "../src/index.js";

describe("schémas", () => {
  it("refuse une clé inconnue", async () => {
    await expect(updateExpenseSchema.validate({ status: "BOOKED" }, { stripUnknown: false })).rejects.toThrow();
  });
  it("refuse une carte en double", async () => {
    await expect(
      createPaymentAccountSchema.validate({
        kind: PaymentAccountKindDTO.REVOLUT,
        name: "Revolut",
        cards: [{ last4: "1234" }, { last4: "1234" }],
      }),
    ).rejects.toThrow();
  });
  it("met la devise en majuscules", async () => {
    const v = await updateExpenseSchema.validate({ currency: "eur" });
    expect(v.currency).toBe("EUR");
  });
});
