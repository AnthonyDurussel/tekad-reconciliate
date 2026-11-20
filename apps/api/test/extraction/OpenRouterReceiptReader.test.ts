import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { OcrEngineDTO } from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import {
  OpenRouterReceiptReader,
  parseJsonObject,
  toExtraction,
} from "@/extraction/infrastructure/OpenRouterReceiptReader.js";
import type { ChatRequest } from "@/ai/infrastructure/OpenRouterClient.js";

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

/** Le plus petit PNG valide (1 × 1). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const ANSWER = JSON.stringify({
  merchant: "Hetzner Online GmbH",
  date: "2026-11-08",
  totalAmount: 11.57,
  currency: "EUR",
  vatAmount: null,
  vatRate: null,
  cardLast4: "4721",
  paymentMethod: "card",
  categoryCode: "TEL",
  description: "Serveur",
  confidence: 0.92,
  rawCardText: "Mastercard **** 4721",
});

function reader(engine = OcrEngineDTO.MISTRAL_OCR, configured = true) {
  const calls: { apiKey: string; request: ChatRequest }[] = [];
  const r = new OpenRouterReceiptReader(
    async () =>
      configured ? { apiKey: "sk-or-test", model: "mistralai/mistral-small", ocrEngine: engine } : null,
    {
      chat: async (apiKey: string, request: ChatRequest) => {
        calls.push({ apiKey, request });
        return "```json\n" + ANSWER + "\n```";
      },
    },
  );
  return { r, calls };
}

const parts = (request: ChatRequest) =>
  request.messages[1].content as Exclude<ChatRequest["messages"][1]["content"], string>;

describe("OpenRouterReceiptReader", () => {
  it("PDF : Mistral OCR (file-parser), JSON structuré, modèle des réglages", async () => {
    const { r, calls } = reader();
    const e = await r.read(
      { fileName: "hetzner.pdf", mimeType: "application/pdf", data: Buffer.from("%PDF-1.4") },
      { categories, knownCards: ["4721"] },
    );
    expect(e).toMatchObject({ merchant: "Hetzner Online GmbH", totalAmount: 11.57, cardLast4: "4721", categoryCode: "TEL" });
    const { apiKey, request } = calls[0];
    expect(apiKey).toBe("sk-or-test");
    expect(request.model).toBe("mistralai/mistral-small");
    expect(request.plugins).toEqual([{ id: "file-parser", pdf: { engine: "mistral-ocr" } }]);
    expect(request.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
    const file = parts(request)[1];
    expect(file).toMatchObject({ type: "file", file: { filename: "hetzner.pdf" } });
    expect(parts(request)[0]).toMatchObject({ type: "text" });
  });

  it("photo PNG / JPEG : mise dans un PDF d'une page pour l'OCR", async () => {
    const { r, calls } = reader();
    await r.read({ fileName: "ticket.png", mimeType: "image/png", data: PNG }, { categories, knownCards: [] });
    const file = parts(calls[0].request)[1] as { type: "file"; file: { filename: string; file_data: string } };
    expect(file.type).toBe("file");
    expect(file.file.filename).toBe("ticket.pdf");
    const pdf = await PDFDocument.load(Buffer.from(file.file.file_data.split(",")[1], "base64"));
    expect(pdf.getPageCount()).toBe(1);
  });

  it("WEBP, ou moteur natif : l'image va au modèle", async () => {
    const { r, calls } = reader(OcrEngineDTO.NATIVE);
    await r.read({ fileName: "t.png", mimeType: "image/png", data: PNG }, { categories, knownCards: [] });
    expect(parts(calls[0].request)[1]).toMatchObject({ type: "image_url" });
    const webp = reader();
    await webp.r.read({ fileName: "t.webp", mimeType: "image/webp", data: Buffer.from("x") }, { categories, knownCards: [] });
    expect(parts(webp.calls[0].request)[1]).toMatchObject({ type: "image_url" });
  });

  it("format inconnu, ou IA non configurée : 409", async () => {
    const { r } = reader();
    await expect(
      r.read({ fileName: "a.heic", mimeType: "image/heic", data: Buffer.from("x") }, { categories, knownCards: [] }),
    ).rejects.toThrow(ConflictError);
    const off = reader(OcrEngineDTO.MISTRAL_OCR, false);
    expect(await off.r.isConfigured()).toBe(false);
    await expect(
      off.r.read({ fileName: "a.pdf", mimeType: "application/pdf", data: Buffer.from("x") }, { categories, knownCards: [] }),
    ).rejects.toThrow(/pas configurée/);
  });

  it("parseJsonObject : texte autour, ou pas de JSON", () => {
    expect(parseJsonObject('Voici : {"a": 1} merci')).toEqual({ a: 1 });
    expect(() => parseJsonObject("rien")).toThrow(/sans JSON/);
  });
});
