import type { HttpRequest } from "@azure/functions";
import { ValidationError } from "@/shared/domain/errors.js";

/** Paramètre de requête texte, `undefined` s'il est absent ou vide. */
export function queryString(
  request: HttpRequest,
  name: string,
): string | undefined {
  const value = request.query.get(name)?.trim();
  return value ? value : undefined;
}

/** Paramètre de requête restreint à une énumération (400 sinon). */
export function queryEnum<T extends string>(
  request: HttpRequest,
  name: string,
  values: Record<string, T>,
): T | undefined {
  const value = queryString(request, name);
  if (value === undefined) return undefined;
  if (!(Object.values(values) as string[]).includes(value)) {
    throw new ValidationError(`query: ${name} invalide`);
  }
  return value as T;
}

export function queryBoolean(
  request: HttpRequest,
  name: string,
): boolean | undefined {
  const value = queryString(request, name);
  if (value === undefined) return undefined;
  return value === "true" || value === "1";
}

/** Paramètre de chemin obligatoire. */
export function pathParam(request: HttpRequest, name: string): string {
  const value = request.params[name]?.trim();
  if (!value) {
    throw new ValidationError(`${name} manquant`);
  }
  return value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de chemin : un UUID mal formé est un 400, pas une erreur SQL. */
export function pathId(request: HttpRequest, name = "id"): string {
  const value = pathParam(request, name);
  if (!UUID.test(value)) {
    throw new ValidationError(`${name} invalide`);
  }
  return value;
}
