/**
 * Briques communes aux schémas de corps de requête.
 *
 * Un corps est validé par un schéma Yup **fermé** : toute clé inconnue est
 * refusée (`noUnknown`) — protection contre l'affectation de masse. Le cast
 * reste actif : `"12"` devient `12`. Chaque schéma est annoté
 * `ObjectSchema<XDTO>` : le DTO reste la source de vérité.
 */
import { number, object, string, type ObjectShape } from "yup";

export const MAX_LABEL_LENGTH = 255;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_LONG_TEXT_LENGTH = 20000;

export function strictObject<S extends ObjectShape>(shape: S) {
  return object(shape).noUnknown(true).strict(false);
}

/** Texte libre optionnel : `undefined` garde, `null` efface. */
export const optionalText = (max = MAX_TEXT_LENGTH) =>
  string().trim().max(max).nullable().optional();

export const requiredLabel = () =>
  string().trim().min(1).max(MAX_LABEL_LENGTH).required();

export const optionalId = () => string().trim().uuid().nullable().optional();

/** Jour `YYYY-MM-DD`. */
export const optionalDay = () =>
  string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format YYYY-MM-DD")
    .nullable()
    .optional();

/** Jour `YYYY-MM-DD` obligatoire. */
export const requiredDay = () =>
  string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format YYYY-MM-DD")
    .required();

export const optionalChf = () =>
  number().min(0).max(1_000_000_000).nullable().optional();
