/**
 * Jours métier (`YYYY-MM-DD`) : les échéances et dates de revue sont des
 * jours, lus dans le fuseau de l'entreprise.
 */
const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Aujourd'hui à Zurich, `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return ZURICH_DAY.format(now);
}

/** Jour `YYYY-MM-DD` → `Date` à minuit UTC (colonne `@db.Date`). */
export function dayToDate(day: string | null | undefined): Date | null {
  if (!day) return null;
  return new Date(`${day}T00:00:00.000Z`);
}

/** `Date` d'une colonne `@db.Date` → `YYYY-MM-DD`. */
export function dateToDay(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Bornes UTC d'une année civile. */
export function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function isInYear(date: Date | null | undefined, year: number): boolean {
  if (!date) return false;
  const { start, end } = yearBounds(year);
  return date >= start && date < end;
}
