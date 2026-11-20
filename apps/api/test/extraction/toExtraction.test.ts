import { describe, expect, it } from "vitest";
import { toExtraction } from "@/extraction/infrastructure/ClaudeReceiptReader.js";

const categories = [{ code: "TEL", label: "Télécom" }];

describe("toExtraction", () => {
  it("normalise la sortie du modèle", () => {
    expect(
      toExtraction(
        {
          merchant: " Swisscom ",
          date: "2026-11-02",
          totalAmount: -89.9,
          currency: "chf",
          vatAmount: 6.74,
          vatRate: 8.1,
          cardLast4: "4821",
          paymentMethod: "card",
          categoryCode: "TEL",
          description: "Abonnement",
          confidence: 0.9,
          rawCardText: null,
        },
        { categories },
      ),
    ).toMatchObject({
      merchant: "Swisscom",
      totalAmount: 89.9,
      currency: "CHF",
      cardLast4: "4821",
      categoryCode: "TEL",
    });
  });

  it("rejette ce qui est mal formé, recoupe la carte sur le texte", () => {
    const e = toExtraction(
      {
        date: "02.11.2026",
        currency: "francs",
        cardLast4: "48",
        rawCardText: "VISA XXXX XXXX XXXX 9876",
        categoryCode: "INCONNU",
      },
      { categories },
    );
    expect(e.date).toBeNull();
    expect(e.currency).toBeNull();
    expect(e.cardLast4).toBe("9876");
    expect(e.categoryCode).toBeNull();
  });
});
