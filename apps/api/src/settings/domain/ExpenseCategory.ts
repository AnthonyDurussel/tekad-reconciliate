import type {
  CreateExpenseCategoryDTO,
  UpdateExpenseCategoryDTO,
} from "@repo/models";

export interface ExpenseCategoryProps {
  id: string;
  /** Compte de charge bexio repris (`null` : type saisi à la main). */
  bexioAccountId: number | null;
  code: string;
  label: string;
  bexioAccountNo: string;
  bexioTaxId: number | null;
  vatRate: number | null;
  keywords: string[];
  mccCodes: string[];
  position: number;
  active: boolean;
}

const clean = (values: string[] | undefined) => [
  ...new Set((values ?? []).map((v) => v.trim()).filter(Boolean)),
];

export function createExpenseCategory(
  id: string,
  input: CreateExpenseCategoryDTO,
): ExpenseCategoryProps {
  return {
    id,
    bexioAccountId: input.bexioAccountId ?? null,
    code: input.code.trim(),
    label: input.label.trim(),
    bexioAccountNo: input.bexioAccountNo,
    bexioTaxId: input.bexioTaxId ?? null,
    vatRate: input.vatRate ?? null,
    keywords: clean(input.keywords),
    mccCodes: clean(input.mccCodes),
    position: input.position ?? 0,
    active: input.active ?? true,
  };
}

export function patchExpenseCategory(
  current: ExpenseCategoryProps,
  input: UpdateExpenseCategoryDTO,
): ExpenseCategoryProps {
  return {
    ...current,
    bexioAccountId:
      input.bexioAccountId !== undefined
        ? input.bexioAccountId
        : current.bexioAccountId,
    code: input.code?.trim() ?? current.code,
    label: input.label?.trim() ?? current.label,
    bexioAccountNo: input.bexioAccountNo ?? current.bexioAccountNo,
    bexioTaxId:
      input.bexioTaxId !== undefined ? input.bexioTaxId : current.bexioTaxId,
    vatRate: input.vatRate !== undefined ? input.vatRate : current.vatRate,
    keywords: input.keywords ? clean(input.keywords) : current.keywords,
    mccCodes: input.mccCodes ? clean(input.mccCodes) : current.mccCodes,
    position: input.position ?? current.position,
    active: input.active ?? current.active,
  };
}

/**
 * Règles de reconnaissance proposées à la création d'un type repris de bexio,
 * par numéro de compte du plan comptable PME suisse (à adapter ensuite).
 */
export const DEFAULT_RULES_BY_ACCOUNT: Record<
  string,
  { keywords: string[]; mccCodes: string[] }
> = {
  "6200": {
    keywords: [
      "shell",
      "avia",
      "tamoil",
      "migrol",
      "socar",
      "parking",
      "garage",
    ],
    mccCodes: ["5541", "5542", "7523", "7538"],
  },
  "6500": {
    keywords: ["papeterie", "office world", "la poste"],
    mccCodes: ["5111", "5943", "9402"],
  },
  "6510": {
    keywords: ["swisscom", "salt", "sunrise", "wingo", "yallo"],
    mccCodes: ["4814", "4899"],
  },
  "6570": {
    keywords: [
      "google",
      "microsoft",
      "adobe",
      "github",
      "aws",
      "openai",
      "anthropic",
      "notion",
      "atlassian",
      "slack",
      "zoom",
      "figma",
      "jetbrains",
      "vercel",
      "hetzner",
      "elevenlabs",
      "infomaniak",
      "hostpoint",
      "openrouter",
    ],
    mccCodes: ["5734", "5817", "5818", "7372", "4816"],
  },
  "6600": {
    keywords: [
      "linkedin",
      "meta platforms",
      "facebook",
      "google ads",
      "mailchimp",
    ],
    mccCodes: ["7311"],
  },
  "6640": {
    keywords: [
      "restaurant",
      "sbb",
      "cff",
      "easyjet",
      "hotel",
      "booking com",
      "airbnb",
      "uber",
    ],
    mccCodes: ["5812", "5813", "5814", "4111", "4112", "4121", "7011"],
  },
  "6940": { keywords: ["frais bancaires"], mccCodes: [] },
};
