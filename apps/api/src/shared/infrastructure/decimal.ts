/** `Decimal` Prisma (ou nombre, ou chaîne) → `number` ; `null` reste `null`. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}
