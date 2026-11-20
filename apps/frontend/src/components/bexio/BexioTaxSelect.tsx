import type { ReactNode } from "react";
import { NumberInput, Select, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { BexioTaxDTO } from "@repo/models";
import { useGetBexioTaxesQuery } from "@/store/slices/api";
import { bexioTaxOptions } from "./bexioOptions";

/**
 * Un code TVA bexio, la TVA préalable d'abord. Sans bexio, le `tax_id` se
 * saisit à la main.
 */
export default function BexioTaxSelect({
  label,
  description,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: ReactNode;
  description?: ReactNode;
  value: number | "";
  onChange: (taxId: number | "", tax: BexioTaxDTO | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { data: taxes, isLoading, isError } = useGetBexioTaxesQuery();

  if (isError || (!isLoading && !taxes)) {
    return (
      <NumberInput
        label={label}
        description={
          <>
            {description}
            {description ? " " : null}
            <Text span size="xs" c="orange.7">
              {t("bexio.notConnectedHint")}
            </Text>
          </>
        }
        placeholder={placeholder}
        min={1}
        allowDecimal={false}
        value={value}
        readOnly={readOnly}
        onChange={(v) => onChange(v === "" ? "" : Number(v), null)}
      />
    );
  }

  const list = taxes ?? [];
  return (
    <Select
      label={label}
      description={description}
      placeholder={
        isLoading ? t("bexio.loading") : (placeholder ?? t("bexio.noTax"))
      }
      data={bexioTaxOptions(list, value === "" ? null : value, {
        preTax: t("bexio.preTax"),
        other: t("bexio.otherTax"),
      })}
      value={value === "" ? null : String(value)}
      readOnly={readOnly}
      disabled={isLoading}
      searchable
      clearable
      nothingFoundMessage={t("bexio.noTaxFound")}
      onChange={(v) => {
        const id = v ? Number(v) : "";
        onChange(id, list.find((x) => x.id === id) ?? null);
      }}
    />
  );
}
