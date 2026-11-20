import type { TFunction } from "i18next";

/**
 * Options de liste déroulante d'une énumération, libellées par i18n
 * (`enum.<namespace>.<valeur>`).
 */
export function enumOptions<T extends string>(
  t: TFunction,
  namespace: string,
  values: Record<string, T> | readonly T[],
) {
  const list = Array.isArray(values) ? values : Object.values(values);
  return (list as T[]).map((value) => ({
    value,
    label: t(`enum.${namespace}.${value}`),
  }));
}
