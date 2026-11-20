import { createHash } from "node:crypto";
import { last4OfMasked, normalizeText, requiresReceipt } from "@repo/models";
import type { RevolutTransactionImport } from "@/revolut/domain/RevolutTransaction.js";

/**
 * Lecture d'un relevé exporté de Revolut Business (CSV, « Transactions →
 * Relevé »).
 *
 * Format de référence (export anglais) : `Date started (UTC)`, `Date
 * completed (UTC)`, `ID`, `Type` (`CARD_PAYMENT`, `FEE`, `CARD_REFUND`…),
 * `State` (`COMPLETED`…), `Description` (le commerçant), `Card number`
 * (`516760******4721`), `Orig currency` / `Orig amount` (devise et montant du
 * commerçant, sans signe), `Payment currency` / `Amount` (signé, devise du
 * compte), `Total amount` (= Amount + Fee : ce qui sort du compte), `Fee`,
 * `Account` (« CHF Main »), `MCC`.
 *
 * Montant retenu : `Total amount` (frais de change compris, c'est ce qui se
 * comptabilise) ; le rapprochement compare aussi `Orig amount` dans sa devise.
 *
 * Les colonnes se reconnaissent par leur nom, anglais ou français, quel que
 * soit leur ordre (« Date completed (UTC) », « Type », « State »,
 * « Description », « Card number », « Orig currency », « Orig amount »,
 * « Payment currency », « Amount », « Fee », « Account », « MCC »…) ; séparateur
 * virgule, point-virgule ou tabulation ; nombres « 1,234.50 », « 1'234.50 »
 * ou « 1234,50 » ; dates ISO, `jj/mm/aaaa` ou `jj.mm.aaaa`. Une ligne par
 * compte : un change entre deux comptes fait deux lignes du même ID.
 */

type Field =
  | "id"
  | "completed"
  | "started"
  | "type"
  | "state"
  | "description"
  | "reference"
  | "payer"
  | "card"
  | "origCurrency"
  | "origAmount"
  | "currency"
  | "amount"
  | "total"
  | "fee"
  | "account"
  | "mcc"
  | "merchant";

/** Noms de colonne reconnus (normalisés : minuscules, sans accents ni ponctuation). */
const ALIASES: Record<Field, string[]> = {
  id: ["id", "transaction id", "identifiant", "id de transaction"],
  completed: [
    "date completed utc",
    "date completed",
    "completed date",
    "date de fin utc",
    "date de fin",
    "date d achevement",
    "date de completion",
  ],
  started: [
    "date started utc",
    "date started",
    "started date",
    "date de debut utc",
    "date de debut",
    "date",
  ],
  type: ["type", "transaction type", "type de transaction"],
  state: ["state", "status", "etat", "statut"],
  description: ["description", "libelle"],
  reference: ["reference"],
  payer: ["payer", "payeur"],
  card: ["card number", "card", "numero de carte", "carte"],
  origCurrency: [
    "orig currency",
    "original currency",
    "devise d origine",
    "devise originale",
  ],
  origAmount: [
    "orig amount",
    "original amount",
    "montant d origine",
    "montant original",
  ],
  currency: ["payment currency", "currency", "devise de paiement", "devise"],
  amount: ["amount", "montant"],
  total: ["total amount", "montant total"],
  fee: ["fee", "frais"],
  account: ["account", "compte", "account name", "nom du compte"],
  mcc: ["mcc", "merchant category code"],
  merchant: ["merchant", "merchant name", "commercant", "nom du commercant"],
};

export interface StatementParseResult {
  rows: RevolutTransactionImport[];
  errors: string[];
}

/** Séparateur le plus présent sur la ligne d'en-tête. */
function delimiterOf(header: string): string {
  const counts = [",", ";", "\t"].map(
    (d) => [d, header.split(d).length] as const,
  );
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** CSV RFC 4180 (guillemets, guillemets doublés, retours à la ligne cités). */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const content = text.replace(/^﻿/, "");
  const sep = delimiter ?? delimiterOf(content.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** « 1,234.50 », « 1'234.50 », « -1 234,50 », « (12.00) » → nombre ; vide → `null`. */
export function parseAmount(value: string | undefined): number | null {
  if (value === undefined) return null;
  let v = value.trim().replace(/[\s'’ ]/g, "");
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  v = v.replace(/^[A-Z]{3}/i, "").replace(/[A-Z]{3}$/i, "");
  if (!/^[-+]?\d[\d.,]*$/.test(v)) return null;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma > lastDot) {
    // « 1,234 » ou « 12,345,678 » : milliers ; sinon virgule décimale (« 1.234,50 », « 12,5 »).
    v =
      lastDot === -1 && /^-?\d{1,3}(,\d{3})+$/.test(v)
        ? v.replace(/,/g, "")
        : v.replace(/\./g, "").replace(",", ".");
  } else {
    v = v.replace(/,/g, "");
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Date ISO, `jj/mm/aaaa` ou `jj.mm.aaaa` (heure facultative), lue en UTC. */
export function parseDate(value: string | undefined): Date | null {
  const v = value?.trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
    v,
  );
  if (m) {
    return new Date(
      Date.UTC(
        +m[1],
        +m[2] - 1,
        +m[3],
        +(m[4] ?? 0),
        +(m[5] ?? 0),
        +(m[6] ?? 0),
      ),
    );
  }
  m =
    /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(
      v,
    );
  if (m) {
    return new Date(
      Date.UTC(
        +m[3],
        +m[2] - 1,
        +m[1],
        +(m[4] ?? 0),
        +(m[5] ?? 0),
        +(m[6] ?? 0),
      ),
    );
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const TYPE_ALIASES: Record<string, string> = {
  paiement_par_carte: "card_payment",
  paiement_carte: "card_payment",
  card: "card_payment",
  virement: "transfer",
  echange: "exchange",
  change: "exchange",
  frais: "fee",
  recharge: "topup",
  remboursement: "refund",
  remboursement_carte: "card_refund",
};

/** « CARD_PAYMENT », « Card Payment », « Paiement par carte » → `card_payment`. */
export function normalizeType(value: string | undefined): string {
  const t = normalizeText(value).replace(/ /g, "_");
  return TYPE_ALIASES[t] ?? (t || "unknown");
}

/** « COMPLETED », « Terminé », « En attente » → `completed`, `pending`… */
export function normalizeState(value: string | undefined): string {
  const s = normalizeText(value);
  if (!s) return "completed";
  if (/^(completed|complete|termine|effectue|execute|done)/.test(s))
    return "completed";
  if (/^(pending|en attente|en cours)/.test(s)) return "pending";
  if (/^(reverted|annule|reverse|rembourse)/.test(s)) return "reverted";
  if (/^(declined|refuse|rejete)/.test(s)) return "declined";
  if (/^(failed|echoue|echec)/.test(s)) return "failed";
  return s.replace(/ /g, "_");
}

/** Le commerçant d'une description Revolut (« To Migros », « Paiement à Coop »). */
export function merchantOf(
  description: string | null,
  type: string,
): string | null {
  if (!description) return null;
  if (type !== "card_payment" && type !== "transfer") return null;
  return (
    description
      .replace(/^(payment to|paiement a|paiement à|to|à|a|vers)\s+/i, "")
      .trim() || null
  );
}

function headerIndex(header: string[]): Partial<Record<Field, number>> {
  const normalized = header.map((h) => normalizeText(h));
  const index: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) {
      const i = normalized.indexOf(alias);
      if (i >= 0 && !Object.values(index).includes(i)) {
        index[field] = i;
        break;
      }
    }
  }
  return index;
}

/** Identifiant stable d'une ligne sans colonne ID (relevé d'un autre format). */
function syntheticId(parts: (string | number | null)[]): string {
  return `csv-${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}`;
}

export function parseRevolutStatement(text: string): StatementParseResult {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) {
    return { rows: [], errors: ["le fichier ne contient aucune transaction"] };
  }
  const header = table[0];
  const col = headerIndex(header);
  const missing = (["amount"] as Field[]).filter((f) => col[f] === undefined);
  if (col.completed === undefined && col.started === undefined)
    missing.push("completed");
  if (missing.length) {
    return {
      rows: [],
      errors: [
        `colonnes introuvables (${missing.join(", ")}) — en-tête lu : ${header.join(" | ")}`,
      ],
    };
  }
  const rows: RevolutTransactionImport[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (f: Field) =>
      col[f] === undefined ? undefined : cells[col[f]!]?.trim() || undefined;
    const amount = parseAmount(get("total")) ?? parseAmount(get("amount"));
    const date = parseDate(get("completed")) ?? parseDate(get("started"));
    if (amount === null) {
      errors.push(
        `ligne ${line} : montant illisible (« ${get("amount") ?? ""} »)`,
      );
      return;
    }
    if (!date) {
      errors.push(`ligne ${line} : date illisible`);
      return;
    }
    const type = normalizeType(
      get("type") ?? (amount < 0 ? "card_payment" : "topup"),
    );
    const state = normalizeState(get("state"));
    const description = get("description") ?? get("reference") ?? null;
    const account = get("account") ?? get("currency") ?? "Revolut";
    const currency = (get("currency") ?? "CHF").toUpperCase();
    const origCurrency = get("origCurrency")?.toUpperCase() ?? null;
    const origRaw = parseAmount(get("origAmount"));
    // Sans signe dans l'export : celui du montant débité.
    const origAmount =
      origRaw === null ? null : Math.sign(amount || -1) * Math.abs(origRaw);
    const revolutId =
      get("id") ??
      syntheticId([date.toISOString(), amount, currency, description, account]);
    // Même ID et même compte deux fois (rare) : jambes distinctes.
    const key = `${revolutId}|${account}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    rows.push({
      revolutId,
      legId: n === 1 ? account : `${account}#${n}`,
      revolutAccountId: account,
      type,
      state,
      occurredAt: date,
      description,
      merchantName: get("merchant") ?? merchantOf(description, type),
      merchantCity: null,
      merchantCountry: null,
      mcc: get("mcc") ?? null,
      amount,
      currency,
      billAmount: origAmount ?? amount,
      billCurrency: origCurrency ?? currency,
      cardLast4: last4OfMasked(get("card")),
      requiresReceipt: requiresReceipt({ type, state, amount }),
      raw: Object.fromEntries(header.map((h, j) => [h, cells[j] ?? null])),
    });
  });
  return { rows, errors };
}
