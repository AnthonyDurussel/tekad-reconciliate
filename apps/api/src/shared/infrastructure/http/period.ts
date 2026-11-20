import type { HttpRequest } from "@azure/functions";
import { ValidationError } from "@/shared/domain/errors.js";
import { todayIso } from "@/shared/domain/dates.js";
import { queryString } from "@/shared/infrastructure/http/query.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Jour `YYYY-MM-DD` d'un paramètre de requête (400 si mal formé). */
export function queryDay(
  request: HttpRequest,
  name: string,
): string | undefined {
  const value = queryString(request, name);
  if (value === undefined) return undefined;
  if (!DAY.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`query: ${name} invalide (YYYY-MM-DD)`);
  }
  return value;
}

/** `from` / `to` ; par défaut le mois en cours jusqu'à aujourd'hui. */
export function queryPeriod(request: HttpRequest): {
  from: string;
  to: string;
} {
  const today = todayIso();
  return {
    from: queryDay(request, "from") ?? `${today.slice(0, 7)}-01`,
    to: queryDay(request, "to") ?? today,
  };
}
