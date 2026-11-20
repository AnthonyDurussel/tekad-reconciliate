/**
 * Règles pures de la réconciliation, partagées par l'API et l'interface :
 * carte lue sur le ticket → compte de paiement, type de dépense proposé,
 * rapprochement pièce ↔ transaction Revolut, statut et écriture proposée.
 */
import {
  BookingModeDTO,
  ReconciliationModeDTO,
} from "../@types/dto/settings.dto.js";
import {
  ExpenseStatusDTO,
  type BookingProposalDTO,
} from "../@types/dto/expense.dto.js";

// ---------------------------------------------------------------- carte

const CARD_PATTERNS: RegExp[] = [
  // **** **** **** 1234, XXXX XXXX XXXX 1234, ************1234, xxxx-1234
  /(?:[*xX•·#]{2,}[\s-]*){1,4}(\d{4})(?!\d)/,
  // Carte / Card / Karte / PAN / No ... 1234
  /(?:carte|card|karte|pan|kartennummer|card\s*no|n°\s*carte)[^\d\n]{0,20}(?:\d{4,6}[\s*xX•-]+)?[\s*xX•-]*(\d{4})(?!\d)/i,
  // 4 premiers + masque + 4 derniers : 5354 56** **** 1234
  /\b\d{4}\s?\d{2}[*xX]{2}[\s*xX]{4,9}(\d{4})\b/,
];

/**
 * 4 derniers chiffres d'une carte dans le texte d'un ticket (« **** 1234 »,
 * « XXXXXXXXXXXX1234 », « Carte : ...1234 »). `null` si rien de sûr.
 */
export function detectCardLast4(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const pattern of CARD_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Un numéro de carte saisi (entier, espacé ou masqué) : ses 4 derniers
 * chiffres et une forme masquée — 6 premiers et 4 derniers chiffres quand il
 * y en a assez, jamais le numéro entier. `null` sans 4 chiffres finaux.
 */
export function maskCardNumber(
  input: string | null | undefined,
): { last4: string; masked: string } | null {
  const raw = (input ?? "").replace(/[\s-]/g, "");
  const tail = /(\d{4})$/.exec(raw);
  if (!tail) return null;
  const digits = raw.replace(/\D/g, "");
  const total = raw.length;
  // Premiers chiffres connus (BIN) quand le numéro commence par eux.
  const lead = /^(\d{6})/.exec(raw)?.[1] ?? null;
  const length = Math.max(total, 16);
  const masked = lead && digits.length >= 10
    ? `${lead}${"*".repeat(Math.max(length - 10, 2))}${tail[1]}`
    : `${"*".repeat(Math.max(length - 4, 4))}${tail[1]}`;
  return { last4: tail[1], masked };
}

/** 4 derniers chiffres d'un numéro masqué Revolut (`459876******1234`). */
export function last4OfMasked(masked: string | null | undefined): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export interface CardOwner {
  id: string;
  active: boolean;
  cards: { last4: string; active?: boolean }[];
}

/** Le compte de paiement dont une carte active finit par `last4`. */
export function accountForCard<T extends CardOwner>(
  last4: string | null | undefined,
  accounts: readonly T[],
): T | null {
  if (!last4) return null;
  return (
    accounts.find(
      (a) =>
        a.active && a.cards.some((c) => c.active !== false && c.last4 === last4),
    ) ?? null
  );
}

// ---------------------------------------------------------- texte

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "sa", "ag", "gmbh", "sarl", "ltd", "inc", "the", "de", "la", "le", "les",
  "du", "des", "et", "und", "com", "www", "ch", "llc", "bv", "sas",
]);

function tokens(value: string | null | undefined): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
  );
}

/** Ressemblance de deux noms de commerçant, de 0 à 1. */
export function merchantSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) {
    if (tb.has(t) || [...tb].some((u) => u.startsWith(t) || t.startsWith(u))) {
      common++;
    }
  }
  return common / Math.min(ta.size, tb.size);
}

// ------------------------------------------------------- type de dépense

export interface CategoryRule {
  id: string;
  active: boolean;
  keywords: string[];
  mccCodes: string[];
}

/**
 * Type de dépense déduit des règles : un mot-clé dans le commerçant ou la
 * description (le plus long gagne), sinon le code MCC de la transaction.
 */
export function categoryByRules<T extends CategoryRule>(
  input: { merchant?: string | null; description?: string | null; mcc?: string | null },
  categories: readonly T[],
): T | null {
  const haystack = ` ${normalizeText(`${input.merchant ?? ""} ${input.description ?? ""}`)} `;
  let best: { category: T; length: number } | null = null;
  for (const category of categories) {
    if (!category.active) continue;
    for (const keyword of category.keywords) {
      const k = normalizeText(keyword);
      if (k && haystack.includes(` ${k}`) && (!best || k.length > best.length)) {
        best = { category, length: k.length };
      }
    }
  }
  if (best) return best.category;
  if (input.mcc) {
    return (
      categories.find((c) => c.active && c.mccCodes.includes(input.mcc!)) ??
      null
    );
  }
  return null;
}

// ------------------------------------------------------ transactions Revolut

/** Types de transaction Revolut qui ne sont pas des dépenses à justifier. */
const NO_RECEIPT_TYPES = new Set([
  "exchange",
  "topup",
  "topup_return",
  "fee",
  "tax",
  "tax_refund",
  "card_refund",
  "card_credit",
  "refund",
  "loan",
]);

/** Une sortie Revolut exige une pièce : débit effectué, hors change / frais / remboursement. */
export function requiresReceipt(tx: {
  type: string;
  state: string;
  amount: number;
}): boolean {
  return (
    tx.amount < 0 &&
    (tx.state === "completed" || tx.state === "pending") &&
    !NO_RECEIPT_TYPES.has(tx.type)
  );
}

// ------------------------------------------------------------ rapprochement

export interface MatchableExpense {
  date: string | null;
  totalAmount: number | null;
  currency: string | null;
  merchant: string | null;
  cardLast4: string | null;
}

export interface MatchableTransaction {
  date: string;
  amount: number;
  currency: string;
  billAmount: number | null;
  billCurrency: string | null;
  merchantName: string | null;
  description: string | null;
  cardLast4: string | null;
}

export interface MatchScore {
  score: number;
  reasons: string[];
}

/** Écart de jours entre deux dates ISO (le jour seul compte). */
export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round(Math.abs(da - db) / 86_400_000);
}

const MAX_DAYS = 5;

/**
 * Note de 0 à 100 d'un couple pièce ↔ transaction. Le montant est
 * éliminatoire : égal (à 1 centime) au montant du compte ou au montant
 * facturé dans la devise du ticket. Puis la date (≤ 5 jours), la carte et le
 * commerçant départagent.
 */
export function scoreMatch(
  expense: MatchableExpense,
  tx: MatchableTransaction,
): MatchScore {
  const reasons: string[] = [];
  if (expense.totalAmount == null || !expense.date) return { score: 0, reasons };
  const amount = Math.abs(expense.totalAmount);
  const currency = (expense.currency ?? "CHF").toUpperCase();
  const sameAccountAmount =
    tx.currency.toUpperCase() === currency &&
    Math.abs(Math.abs(tx.amount) - amount) <= 0.01;
  const sameBillAmount =
    tx.billAmount != null &&
    (tx.billCurrency ?? "").toUpperCase() === currency &&
    Math.abs(Math.abs(tx.billAmount) - amount) <= 0.01;
  if (!sameAccountAmount && !sameBillAmount) return { score: 0, reasons };
  let score = 50;
  reasons.push("amount");

  const days = daysBetween(expense.date, tx.date);
  if (days > MAX_DAYS) return { score: 0, reasons: [] };
  score += days === 0 ? 20 : days <= 2 ? 12 : 5;
  reasons.push(days === 0 ? "sameDay" : "closeDate");

  if (expense.cardLast4 && tx.cardLast4) {
    if (expense.cardLast4 === tx.cardLast4) {
      score += 15;
      reasons.push("card");
    } else {
      score -= 30;
      reasons.push("otherCard");
    }
  }

  const similarity = Math.max(
    merchantSimilarity(expense.merchant, tx.merchantName),
    merchantSimilarity(expense.merchant, tx.description),
  );
  if (similarity > 0) {
    score += Math.round(15 * similarity);
    reasons.push("merchant");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/** Rapprochement automatique : note ≥ 70 et 10 points d'avance sur la suivante. */
export const AUTO_MATCH_SCORE = 70;

export function rankCandidates<T extends MatchableTransaction>(
  expense: MatchableExpense,
  transactions: readonly T[],
): { transaction: T; score: number; reasons: string[] }[] {
  return transactions
    .map((transaction) => ({ transaction, ...scoreMatch(expense, transaction) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function autoMatch<T extends MatchableTransaction>(
  expense: MatchableExpense,
  transactions: readonly T[],
): T | null {
  const [first, second] = rankCandidates(expense, transactions);
  if (!first || first.score < AUTO_MATCH_SCORE) return null;
  if (second && first.score - second.score < 10) return null;
  return first.transaction;
}

// --------------------------------------------------------- statut, écriture

export interface StatusInput {
  status: ExpenseStatusDTO;
  extracted: boolean;
  date: string | null;
  totalAmount: number | null;
  paymentAccount: { reconciliation: ReconciliationModeDTO } | null;
  hasCategory: boolean;
  transactionId: string | null;
}

/**
 * Ce qui manque à une pièce pour être comptabilisée (codes stables). Un
 * compte rapproché par import de relevé exige la transaction de la pièce.
 */
export function missingForBooking(input: Omit<StatusInput, "status" | "extracted">): string[] {
  const missing: string[] = [];
  if (!input.date) missing.push("date");
  if (input.totalAmount == null) missing.push("amount");
  if (!input.paymentAccount) missing.push("paymentAccount");
  if (!input.hasCategory) missing.push("category");
  if (
    input.paymentAccount?.reconciliation ===
      ReconciliationModeDTO.STATEMENT_IMPORT &&
    !input.transactionId
  ) {
    missing.push("transaction");
  }
  return missing;
}

/** Statut calculé ; BOOKED et IGNORED se gardent, NEW tant qu'elle n'est pas lue. */
export function expenseStatus(input: StatusInput): ExpenseStatusDTO {
  if (
    input.status === ExpenseStatusDTO.BOOKED ||
    input.status === ExpenseStatusDTO.IGNORED
  ) {
    return input.status;
  }
  if (!input.extracted) return ExpenseStatusDTO.NEW;
  return missingForBooking(input).length === 0
    ? ExpenseStatusDTO.READY
    : ExpenseStatusDTO.TO_REVIEW;
}

export interface BookingInput {
  date: string | null;
  merchant: string | null;
  description: string | null;
  totalAmount: number | null;
  currency: string | null;
  /** Montant débité du compte Revolut, en CHF. */
  transactionAmountChf: number | null;
  paymentAccount: {
    reconciliation: ReconciliationModeDTO;
    bexioAccountNo: string | null;
    bookingMode: BookingModeDTO;
  } | null;
  category: {
    bexioAccountNo: string;
    bexioTaxId: number | null;
    vatRate: number | null;
    label: string;
  } | null;
  debitAccountNo: string | null;
  creditAccountNo: string | null;
  bexioTaxId: number | null;
  transactionId: string | null;
}

/**
 * L'écriture proposée : débit du compte de charge du type, crédit du compte
 * de paiement, TVA du type ; chaque valeur saisie sur la pièce l'emporte.
 * En devise étrangère, le montant CHF vient de la transaction Revolut.
 */
export function bookingProposal(input: BookingInput): BookingProposalDTO {
  const currency = (input.currency ?? "CHF").toUpperCase();
  const amountChf =
    input.transactionAmountChf != null
      ? Math.abs(input.transactionAmountChf)
      : currency === "CHF" && input.totalAmount != null
        ? Math.abs(input.totalAmount)
        : null;
  const debitAccountNo =
    input.debitAccountNo ?? input.category?.bexioAccountNo ?? null;
  const creditAccountNo =
    input.creditAccountNo ?? input.paymentAccount?.bexioAccountNo ?? null;
  const description = [input.merchant, input.description ?? input.category?.label]
    .filter(Boolean)
    .join(" — ");
  const missing = missingForBooking({
    date: input.date,
    totalAmount: input.totalAmount,
    paymentAccount: input.paymentAccount,
    hasCategory: !!input.category || !!input.debitAccountNo,
    transactionId: input.transactionId,
  });
  if (amountChf == null && !missing.includes("amount")) missing.push("amountChf");
  if (!debitAccountNo) missing.push("debitAccount");
  if (!creditAccountNo) missing.push("creditAccount");
  return {
    mode: input.paymentAccount?.bookingMode ?? null,
    date: input.date,
    description: description || "Dépense",
    amountChf: amountChf == null ? null : Math.round(amountChf * 100) / 100,
    debitAccountNo,
    creditAccountNo,
    bexioTaxId: input.bexioTaxId ?? input.category?.bexioTaxId ?? null,
    vatRate: input.category?.vatRate ?? null,
    missing: [...new Set(missing)],
  };
}
