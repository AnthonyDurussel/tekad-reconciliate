/**
 * Formats des tableaux de bord (repris de stoll-stock-management) : un
 * « +12 % » se lit partout de la même façon.
 */

/** « 12 % » — un taux est une fraction de 1 ; `null` se lit « — ». */
export function formatRate(
  rate: number | null | undefined,
  digits = 0,
): string {
  if (rate === null || rate === undefined) return "—";
  return new Intl.NumberFormat("fr-CH", {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(rate);
}

/** Variation relative de `previous` à `current` ; `null` sans référence. */
export function changeRatio(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}

/** Une variation relative signée : « +12 % », « −3 % ». */
export function formatChangeRatio(ratio: number | null): string | null {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const sign = ratio > 0 ? "+" : ratio < 0 ? "−" : "±";
  return `${sign}${formatRate(Math.abs(ratio))}`;
}

/**
 * Le sens d'une variation pour la couleur : `up` est-il une bonne nouvelle ?
 * (Plus de pièces comptabilisées, oui ; plus de pièces manquantes, non.)
 */
export function changeTone(
  change: number | null,
  upIsGood: boolean | null,
): "good" | "bad" | "neutral" {
  if (change === null || change === 0 || upIsGood === null) return "neutral";
  return change > 0 === upIsGood ? "good" : "bad";
}
