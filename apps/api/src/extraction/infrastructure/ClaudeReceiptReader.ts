import Anthropic from "@anthropic-ai/sdk";
import { detectCardLast4, type ExtractionDTO } from "@repo/models";
import { ConflictError } from "@/shared/domain/errors.js";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import type {
  IReceiptReader,
  ReceiptReadingContext,
} from "@/extraction/application/ports/IReceiptReader.js";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const nullable = (type: string) => ({ type: [type, "null"] });

/** Schéma de la sortie structurée (tous les champs requis, `null` si absent). */
const SCHEMA = {
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
      description: "Le texte exact du ticket autour du numéro de carte",
    },
  },
} as const;

const SYSTEM = `Tu lis des pièces comptables (tickets de caisse, factures, reçus) d'une PME suisse.
Rends uniquement les champs demandés, tels qu'imprimés sur la pièce ; null si absent ou illisible — ne devine jamais un montant, une date ou un numéro de carte.
- totalAmount : le total effectivement payé (TTC), positif ; currency : la devise de ce total.
- date : la date de la transaction (pas l'échéance), au format YYYY-MM-DD.
- cardLast4 : les 4 derniers chiffres du numéro de carte masqué (« **** 1234 », « XXXXXXXXXXXX1234 », « Karte ...1234 ») ; jamais un autre nombre (terminal, autorisation, transaction). null s'il n'y a pas de numéro de carte.
- categoryCode : le code du type de dépense le plus probable parmi la liste fournie, sinon null.
- confidence : ta confiance globale dans la lecture.`;

/**
 * Adaptateur de lecture par Claude (vision + sortie structurée JSON). Une
 * image ou un PDF ; les autres formats (HEIC…) sont refusés. Le numéro de
 * carte lu est recoupé avec la détection par motif sur le texte rendu.
 */
export class ClaudeReceiptReader implements IReceiptReader {
  readonly configured = true;

  constructor(
    private client: Anthropic,
    private model = "claude-opus-5-5",
  ) {}

  private content(file: StoredFile): Anthropic.Beta.BetaContentBlockParam {
    const data = file.data.toString("base64");
    if (file.mimeType === "application/pdf") {
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      };
    }
    if ((IMAGE_TYPES as readonly string[]).includes(file.mimeType)) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: file.mimeType as ImageType,
          data,
        },
      };
    }
    throw new ConflictError(`format non lisible : ${file.mimeType}`);
  }

  async read(
    file: StoredFile,
    context: ReceiptReadingContext,
  ): Promise<ExtractionDTO> {
    const categories = context.categories
      .map((c) => `${c.code} — ${c.label}`)
      .join("\n");
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            this.content(file),
            {
              type: "text",
              text: `Fichier : ${file.fileName}\nCartes de la société (4 derniers chiffres) : ${
                context.knownCards.join(", ") || "inconnues"
              }\nTypes de dépense :\n${categories || "(aucun)"}`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      throw new ConflictError("la lecture de la pièce a été refusée");
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return toExtraction(JSON.parse(text), context);
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
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

export class UnconfiguredReceiptReader implements IReceiptReader {
  readonly configured = false;
  read(): Promise<ExtractionDTO> {
    throw new ConflictError(
      "la lecture des pièces n'est pas configurée (ANTHROPIC_API_KEY)",
    );
  }
}

export function createReceiptReader(
  env: NodeJS.ProcessEnv = process.env,
): IReceiptReader {
  if (!env.ANTHROPIC_API_KEY?.trim()) return new UnconfiguredReceiptReader();
  return new ClaudeReceiptReader(
    new Anthropic(),
    env.RECEIPT_MODEL?.trim() || "claude-opus-5-5",
  );
}
