import type { ReactNode } from "react";
import { Select, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { BexioAccountDTO, BexioAccountTypeDTO } from "@repo/models";
import { useGetBexioAccountsQuery } from "@/store/slices/api";
import { bexioAccountLabel, bexioAccountOptions } from "./bexioOptions";

/**
 * Un compte du plan comptable bexio, choisi dans la liste des comptes des
 * genres demandés. Sans bexio (409, ou bexio injoignable), le numéro se
 * saisit à la main, avec une note.
 */
export default function BexioAccountSelect({
  label,
  description,
  types,
  value,
  onChange,
  placeholder,
  error,
  readOnly,
  clearable = true,
}: {
  label: ReactNode;
  description?: ReactNode;
  types: readonly BexioAccountTypeDTO[];
  value: string;
  onChange: (accountNo: string, account: BexioAccountDTO | null) => void;
  placeholder?: string;
  error?: ReactNode;
  readOnly?: boolean;
  clearable?: boolean;
}) {
  const { t } = useTranslation();
  const { data: accounts, isLoading, isError } = useGetBexioAccountsQuery();

  if (isError || (!isLoading && !accounts)) {
    return (
      <TextInput
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
        value={value}
        error={error}
        readOnly={readOnly}
        onChange={(e) => onChange(e.currentTarget.value, null)}
      />
    );
  }

  const list = accounts ?? [];
  // La proposition (en gris) se lit avec le nom du compte.
  const proposed = placeholder
    ? list.find((a) => a.accountNo === placeholder)
    : undefined;
  return (
    <Select
      label={label}
      description={description}
      placeholder={
        isLoading
          ? t("bexio.loading")
          : proposed
            ? bexioAccountLabel(proposed)
            : (placeholder ?? t("bexio.pickAccount"))
      }
      data={bexioAccountOptions(list, types, value, (no) =>
        t("bexio.unknownAccount", { accountNo: no }),
      )}
      value={value || null}
      error={error}
      readOnly={readOnly}
      disabled={isLoading}
      searchable
      clearable={clearable}
      nothingFoundMessage={t("bexio.noAccount")}
      onChange={(v) =>
        onChange(v ?? "", list.find((a) => a.accountNo === v) ?? null)
      }
    />
  );
}
