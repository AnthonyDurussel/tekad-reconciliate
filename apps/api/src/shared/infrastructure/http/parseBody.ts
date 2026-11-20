import type { HttpRequest } from "@azure/functions";
import {
  ValidationError as YupValidationError,
  type AnyObject,
  type ObjectSchema,
} from "yup";
import { ValidationError } from "@/shared/domain/errors.js";

/**
 * Options de validation communes aux corps et aux paramètres de requête.
 *
 * - `abortEarly: false` : toutes les erreurs d'un coup, pas une par aller-retour ;
 * - `stripUnknown: false` : une clé inconnue est **refusée** (les schémas sont
 *   fermés par `noUnknown`), jamais retirée en silence — c'est la protection
 *   contre l'affectation de masse ;
 * - le cast reste actif (`strict` absent) : `"12"` devient `12`, une date ISO
 *   devient une `Date`, conformément au type déclaré par le DTO.
 */
const VALIDATE_OPTIONS = { abortEarly: false, stripUnknown: false } as const;

/**
 * Schéma d'objet dont le type d'entrée `T` est le DTO annoté par le schéma
 * (`ObjectSchema<CreateClientDTO>`). On infère `T` depuis ce paramètre et non
 * depuis le type de sortie Yup, qui rend toutes les clés optionnelles et
 * ferait perdre aux contrôleurs les champs `required()` du DTO.
 */
type BodySchema<T extends AnyObject> = ObjectSchema<T, AnyObject, any, any>;

/**
 * Lit et valide le corps JSON d'une requête.
 *
 * Un JSON invalide comme un corps qui ne satisfait pas le schéma remontent en
 * `ValidationError` (400 via `withErrorHandler`), avec les messages Yup joints.
 * Un corps vide ou `null` est traité comme `{}` : les routes qui l'admettent
 * (timbrage, décisions d'absence) le déclarent en n'exigeant aucun champ, les
 * autres échouent sur leurs champs requis — jamais sur le format.
 *
 * ```ts
 * const body = await parseBody(request, createClientSchema); // : CreateClientDTO
 * ```
 */
export async function parseBody<T extends AnyObject>(
  request: HttpRequest,
  schema: BodySchema<T>,
): Promise<T> {
  const raw = await readJsonBody(request);
  return validateWith(schema, raw ?? {}, "body");
}

/**
 * Valide les paramètres de requête (`?limit=50&status=DRAFT`) contre un
 * schéma. Les valeurs arrivent en chaînes : le cast Yup les convertit selon le
 * schéma (`number()`, `boolean()`…). Une clé répétée ne conserve que la
 * dernière valeur — les listes se passent séparées par des virgules, comme
 * partout dans l'API.
 */
export async function parseQuery<T extends AnyObject>(
  request: HttpRequest,
  schema: BodySchema<T>,
): Promise<T> {
  const raw = Object.fromEntries(request.query.entries());
  return validateWith(schema, raw, "query");
}

async function readJsonBody(request: HttpRequest): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ValidationError("body: unable to read request body");
  }

  if (text.trim() === "") {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("body: invalid JSON");
  }
}

async function validateWith<T extends AnyObject>(
  schema: BodySchema<T>,
  value: unknown,
  source: "body" | "query",
): Promise<T> {
  try {
    return (await schema.validate(value, VALIDATE_OPTIONS)) as T;
  } catch (error) {
    if (error instanceof YupValidationError) {
      const messages = error.errors.length ? error.errors : [error.message];
      throw new ValidationError(`${source}: ${messages.join("; ")}`);
    }
    throw error;
  }
}
