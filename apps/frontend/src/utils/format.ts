import dayjs from "dayjs";

const chf = new Intl.NumberFormat("fr-CH", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
});

const chf2 = new Intl.NumberFormat("fr-CH", {
  style: "currency",
  currency: "CHF",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 });

export function formatChf(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : chf.format(value);
}

/** CHF au centime (montants des pièces). */
export function formatChfPrecise(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : chf2.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : number.format(value);
}

export function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : integer.format(value);
}

const amount = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Montant dans sa devise : « 1 234.50 EUR » ; sans devise, le nombre seul. */
export function formatAmount(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value === null || value === undefined) return "—";
  return currency
    ? `${amount.format(value)} ${currency}`
    : amount.format(value);
}

/** Carte masquée « •••• 1234 ». */
export function formatCard(last4: string | null | undefined): string {
  return last4 ? `•••• ${last4}` : "—";
}

export function formatDate(value: string | null | undefined): string {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}

/** « ven. 7 août 2026 ». */
export function formatLongDate(value: string | null | undefined): string {
  return value ? dayjs(value).format("ddd D MMMM YYYY") : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—";
}

/** `Date` (sélecteur) → jour `YYYY-MM-DD` attendu par l'API. */
export function toDay(value: Date | string | null | undefined): string | null {
  return value ? dayjs(value).format("YYYY-MM-DD") : null;
}

export function today(): string {
  return dayjs().format("YYYY-MM-DD");
}
