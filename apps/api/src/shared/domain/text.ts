/**
 * Applique la convention des mises à jour partielles : `undefined` garde la
 * valeur, `null` (ou une chaîne vide) l'efface.
 */
export function patchText(
  current: string | null,
  next: string | null | undefined,
): string | null {
  if (next === undefined) return current;
  if (next === null) return null;
  const trimmed = next.trim();
  return trimmed === "" ? null : trimmed;
}

export function patchValue<T>(current: T, next: T | undefined): T {
  return next === undefined ? current : next;
}

export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
