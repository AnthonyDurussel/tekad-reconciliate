import { PDFDocument } from "pdf-lib";
import {
  detectCardLast4,
  OcrEngineDTO,
  type ExtractionDTO,
} from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import type {
  IReceiptReader,
  ReceiptReadingContext,
} from "@/extraction/application/ports/IReceiptReader.js";
import type { OpenRouterSettings } from "@/ai/domain/aiSettings.js";
import type {
  ChatContentPart,
  OpenRouterClient,
} from "@/ai/infrastructure/OpenRouterClient.js";

const nullable = (type: string) => ({ type: [type, "null"] });

/** Schéma de la sortie structurée (tous les champs requis, `null` si absent). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "merchant",
    "date",
    "totalAmount",
    "currency",
    "vatAmount",
    "vatRate",
    "cardLast4",
    "paymentMethod",
    "categoryCode",
    "description",
    "confidence",
    "rawCardText",
  ],
  properties: {
    merchant: nullable("string"),
    date: { ...nullable("string"), description: "YYYY-MM-DD" },
    totalAmount: {
      ...nullable("number"),
      description: "Total payé, TTC, positif",
    },
    currency: { ...nullable("string"), description: "Code ISO 4217" },
    vatAmount: nullable("number"),
    vatRate: {
      ...nullable("number"),
      description: "Taux principal en %, ex. 8.1",
    },
    cardLast4: {
      ...nullable("string"),
      description: "4 derniers chiffres de la carte",
    },
    paymentMethod: {
      ...nullable("string"),
      description: "card, cash, transfer, invoice, twint, other",
    },
    categoryCode: nullable("string"),
    description: {
      ...nullable("string"),
      description: "Quoi, en quelques mots, en français",
    },
    confidence: { type: "number", description: "0 à 1" },
    rawCardText: {
      ...nullable("string"),
      description: "Le texte exact de la pièce autour du numéro de carte",
    },
  },
} as const;

export const SYSTEM_PROMPT = `Tu lis des pièces comptables (tickets de caisse, factures, reçus) d'une PME suisse. Le document joint a été passé à l'OCR.
Rends uniquement un objet JSON avec les champs demandés, tels qu'imprimés sur la pièce ; null si absent ou illisible — ne devine jamais un montant, une date ou un numéro de carte.
- totalAmount : le total effectivement payé (TTC), positif ; currency : la devise de ce total (code ISO, ex. CHF, EUR, USD).
- date : la date de la transaction ou de la facture (pas l'échéance), au format YYYY-MM-DD.
- cardLast4 : les 4 derniers chiffres du numéro de carte masqué (« **** 1234 », « XXXXXXXXXXXX1234 », « Karte ...1234 ») ; jamais un autre nombre (terminal, autorisation, transaction). null s'il n'y a pas de numéro de carte.
- categoryCode : le code du type de dépense le plus probable parmi la liste fournie, sinon null.
- confidence : ta confiance globale dans la lecture, de 0 à 1.`;

/** Les images que Mistral OCR lit une fois mises dans un PDF d'une page. */
const PDF_WRAPPABLE = ["image/jpeg", "image/png"];
const VISION_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Une photo JPEG / PNG dans un PDF d'une page, à sa taille. */
export async function imageToPdf(file: StoredFile): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const image =
    file.mimeType === "image/png"
      ? await pdf.embedPng(file.data)
      : await pdf.embedJpg(file.data);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });
  return Buffer.from(await pdf.save());
}

const dataUrl = (mime: string, data: Buffer) =>
  `data:${mime};base64,${data.toString("base64")}`;

/**
 * Adaptateur de lecture par OpenRouter : le PDF (ou la photo, mise en PDF)
 * passe par **Mistral OCR** (plugin `file-parser`), puis le modèle choisi
 * dans les réglages en tire les champs en JSON (`response_format`
 * json_schema). Les réglages (clé, modèle, moteur) sont lus à chaque appel :
 * l'écran d'administration s'applique sans redémarrage.
 */
export class OpenRouterReceiptReader implements IReceiptReader {
  constructor(
    private settings: () => Promise<OpenRouterSettings | null>,
    private client: Pick<OpenRouterClient, "chat">,
  ) {}

  async isConfigured(): Promise<boolean> {
    return !!(await this.settings());
  }

  /** La pièce en partie de message : un fichier (OCR) ou, à défaut, une image. */
  async attachment(
    file: StoredFile,
    engine: OcrEngineDTO,
  ): Promise<ChatContentPart> {
    if (file.mimeType === "application/pdf") {
      return {
        type: "file",
        file: {
          filename: file.fileName,
          file_data: dataUrl("application/pdf", file.data),
        },
      };
    }
    if (
      engine !== OcrEngineDTO.NATIVE &&
      PDF_WRAPPABLE.includes(file.mimeType)
    ) {
      return {
        type: "file",
        file: {
          filename: `${file.fileName.replace(/\.[^.]+$/, "")}.pdf`,
          file_data: dataUrl("application/pdf", await imageToPdf(file)),
        },
      };
    }
    if (VISION_IMAGES.includes(file.mimeType)) {
      return {
        type: "image_url",
        image_url: { url: dataUrl(file.mimeType, file.data) },
      };
    }
    throw new ConflictError(`format non lisible : ${file.mimeType}`);
  }

  async read(
    file: StoredFile,
    context: ReceiptReadingContext,
  ): Promise<ExtractionDTO> {
    const settings = await this.settings();
    if (!settings) {
      throw new ConflictError(
        "la lecture des pièces n'est pas configurée (Administration → Intelligence artificielle)",
      );
    }
    const categories = context.categories
      .map((c) => `${c.code} — ${c.label}`)
      .join("\n");
    const text = await this.client.chat(settings.apiKey, {
      model: settings.model,
      temperature: 0,
      max_tokens: 2000,
      plugins: [{ id: "file-parser", pdf: { engine: settings.ocrEngine } }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "piece_comptable",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Fichier : ${file.fileName}\nCartes de la société (4 derniers chiffres) : ${
                context.knownCards.join(", ") || "inconnues"
              }\nTypes de dépense :\n${categories || "(aucun)"}`,
            },
            await this.attachment(file, settings.ocrEngine),
          ],
        },
      ],
    });
    return toExtraction(parseJsonObject(text), context);
  }
}

/** L'objet JSON d'une réponse, même entouré de texte ou d'un bloc ```json. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("réponse du modèle sans JSON");
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("réponse du modèle : objet JSON attendu");
  }
  return value as Record<string, unknown>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/['\s]/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Normalise la sortie du modèle (types, formats) ; testable sans API. */
export function toExtraction(
  raw: Record<string, unknown>,
  context: Pick<ReceiptReadingContext, "categories">,
): ExtractionDTO {
  const date = str(raw.date);
  const currency = str(raw.currency)?.toUpperCase() ?? null;
  const lastFour = str(raw.cardLast4);
  const fromText = detectCardLast4(str(raw.rawCardText));
  const cardLast4 = lastFour && /^\d{4}$/.test(lastFour) ? lastFour : fromText;
  const code = str(raw.categoryCode);
  const total = num(raw.totalAmount);
  return {
    merchant: str(raw.merchant),
    date: date && DAY.test(date) ? date : null,
    totalAmount: total === null ? null : Math.abs(total),
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    vatAmount: num(raw.vatAmount),
    vatRate: num(raw.vatRate),
    cardLast4,
    paymentMethod: str(raw.paymentMethod),
    categoryCode:
      code && context.categories.some((c) => c.code === code) ? code : null,
    description: str(raw.description),
    confidence: num(raw.confidence),
    error: null,
  };
}
