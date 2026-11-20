import {
  BexioAccountTypeDTO,
  maskCardNumber,
  type BexioAccountDTO,
  type BexioTaxDTO,
} from "@repo/models";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  group: string;
  items: SelectOption[];
}

/** Comptes de charge : ceux que débite un type de dépense. */
export const EXPENSE_ACCOUNT_TYPES = [BexioAccountTypeDTO.EXPENSE] as const;

/** Comptes de trésorerie ou de passif : ceux que crédite un paiement. */
export const PAYMENT_ACCOUNT_TYPES = [
  BexioAccountTypeDTO.ASSET,
  BexioAccountTypeDTO.LIABILITY,
] as const;

/** « 6570 — Informatique » */
export const bexioAccountLabel = (
  a: Pick<BexioAccountDTO, "accountNo" | "name">,
) => (a.name ? `${a.accountNo} — ${a.name}` : a.accountNo);

const byNumber = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true });

/**
 * Options d'une liste de comptes bexio : les comptes des genres demandés,
 * actifs (un inactif reste s'il est la valeur courante), triés par numéro,
 * sans doublon. Une valeur courante inconnue de bexio reste choisie, avec
 * `unknownLabel`.
 */
export function bexioAccountOptions(
  accounts: readonly BexioAccountDTO[],
  types: readonly BexioAccountTypeDTO[],
  current?: string | null,
  unknownLabel: (accountNo: string) => string = (no) => no,
): SelectOption[] {
  const seen = new Set<string>();
  const options = accounts
    .filter(
      (a) => a.accountNo === current || (a.active && types.includes(a.type)),
    )
    .sort((a, b) => byNumber(a.accountNo, b.accountNo))
    .filter((a) => {
      if (seen.has(a.accountNo)) return false;
      seen.add(a.accountNo);
      return true;
    })
    .map((a) => ({ value: a.accountNo, label: bexioAccountLabel(a) }));
  const value = current?.trim();
  if (value && !seen.has(value))
    options.unshift({ value, label: unknownLabel(value) });
  return options;
}

/** « VB81 — TVA préalable 8.1 % (8.1 %) » */
export function bexioTaxLabel(tax: BexioTaxDTO): string {
  const name =
    tax.label && tax.label !== tax.code
      ? `${tax.code} — ${tax.label}`
      : tax.code;
  return tax.rate != null ? `${name} (${tax.rate} %)` : name;
}

/**
 * Options des codes TVA bexio : la TVA préalable (achats) d'abord, puis les
 * autres ; actifs seulement, sauf la valeur courante.
 */
export function bexioTaxOptions(
  taxes: readonly BexioTaxDTO[],
  current: number | null | undefined,
  groups: { preTax: string; other: string },
): SelectGroup[] {
  const shown = taxes
    .filter((t) => t.active || t.id === current)
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || byNumber(a.code, b.code));
  const option = (t: BexioTaxDTO) => ({
    value: String(t.id),
    label: bexioTaxLabel(t),
  });
  const preTax = shown.filter((t) => t.type === "pre_tax").map(option);
  const other = shown.filter((t) => t.type !== "pre_tax").map(option);
  if (current != null && !shown.some((t) => t.id === current))
    other.unshift({ value: String(current), label: String(current) });
  const out: SelectGroup[] = [];
  if (preTax.length) out.push({ group: groups.preTax, items: preTax });
  if (other.length) out.push({ group: groups.other, items: other });
  return out;
}

/** Ce que l'on montre d'une saisie de numéro de carte. */
export interface CardNumberInput {
  /** Rien de saisi. */
  empty: boolean;
  /** Saisie lisible : finit par 4 chiffres, sans autre caractère que chiffres, espaces, `*`, `x`, `•`, `.`, `-`. */
  valid: boolean;
  last4: string | null;
  masked: string | null;
}

const CARD_NUMBER = /^[\d\s*xX•.-]*\d{4}$/;

/**
 * Lit un numéro de carte tapé ou collé (entier, espacé ou masqué) : seuls
 * ses 4 derniers chiffres et sa forme masquée en sortent.
 */
export function readCardNumber(input: string): CardNumberInput {
  const value = input.trim();
  if (!value) return { empty: true, valid: false, last4: null, masked: null };
  const read = CARD_NUMBER.test(value) ? maskCardNumber(value) : null;
  return {
    empty: false,
    valid: !!read,
    last4: read?.last4 ?? null,
    masked: read?.masked ?? null,
  };
}
