import { useRef } from "react";
import { Button, Menu, Tooltip, type ButtonProps } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconFileImport } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { PaymentAccountDTO } from "@repo/models";
import {
  useGetPaymentAccountsQuery,
  useImportRevolutStatementMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/format";
import { importableAccounts } from "./statementAccounts";

/** 10 Mo, comme l'API. */
const MAX_BYTES = 10_000_000;

/**
 * Import du relevé CSV d'un compte rapproché par import (Revolut Business,
 * Revolut compte personnel…). Avec plusieurs comptes, on choisit d'abord
 * celui dont c'est le relevé ; avec un seul, le fichier part directement ;
 * sans aucun, le bouton est désactivé. Réimporter un relevé (ou un relevé
 * qui chevauche le précédent) met à jour sans doublon.
 */
export default function RevolutImportButton(props: ButtonProps) {
  const { t } = useTranslation();
  const [importStatement, { isLoading }] = useImportRevolutStatementMutation();
  const { data: accounts = [], isLoading: loadingAccounts } =
    useGetPaymentAccountsQuery();
  const importable = importableAccounts(accounts);
  const inputRef = useRef<HTMLInputElement>(null);
  // Le compte choisi avant d'ouvrir le sélecteur de fichier.
  const targetRef = useRef<PaymentAccountDTO | null>(null);

  const pick = (account: PaymentAccountDTO) => {
    targetRef.current = account;
    inputRef.current?.click();
  };

  const onFile = async (file: File | null) => {
    // Rechoisir le même fichier doit relancer l'import.
    if (inputRef.current) inputRef.current.value = "";
    const target = targetRef.current;
    if (!file || !target) return;
    if (file.size > MAX_BYTES) {
      notifications.show({
        color: "red",
        message: t("revolutImport.tooLarge"),
      });
      return;
    }
    try {
      const result = await importStatement({
        fileName: file.name,
        content: await file.text(),
        paymentAccountId: target.id,
      }).unwrap();
      notifications.show({
        color: result.errors.length ? "orange" : "teal",
        title: t("revolutImport.done", {
          count: result.created + result.updated,
          account: result.paymentAccountName,
        }),
        message: [
          t("revolutImport.detail", {
            created: result.created,
            updated: result.updated,
          }),
          result.from &&
            t("revolutImport.period", {
              from: formatDate(result.from),
              to: formatDate(result.to),
            }),
          t("revolutImport.matched", { count: result.matched }),
          result.cardsAdded.length > 0 &&
            t("revolutImport.cardsAdded", {
              count: result.cardsAdded.length,
              cards: result.cardsAdded.join(", "),
            }),
          result.errors.length > 0 &&
            t("revolutImport.errors", {
              count: result.errors.length,
              first: result.errors[0],
            }),
        ]
          .filter(Boolean)
          .join(" · "),
        autoClose: result.errors.length ? false : 8000,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("revolutImport.failed", { account: target.name }),
        message: getErrorMessage(error),
      });
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      hidden
      onChange={(e) => void onFile(e.currentTarget.files?.[0] ?? null)}
    />
  );
  const icon = <IconFileImport size={16} />;

  if (importable.length === 0) {
    return (
      <Tooltip
        label={
          loadingAccounts ? t("common.loading") : t("revolutImport.noAccount")
        }
        multiline
        w={300}
      >
        {/* Un bouton désactivé ne reçoit pas le survol : on l'enveloppe. */}
        <span style={{ display: "inline-block" }}>
          <Button leftSection={icon} disabled {...props}>
            {t("revolutImport.button")}
          </Button>
        </span>
      </Tooltip>
    );
  }

  if (importable.length === 1) {
    const only = importable[0];
    return (
      <>
        {input}
        <Button
          leftSection={icon}
          loading={isLoading}
          title={t("revolutImport.hintFor", {
            account: only.name,
            format: only.statementFormat
              ? t(`enum.statementFormat.${only.statementFormat}`)
              : "",
          })}
          {...props}
          onClick={() => pick(only)}
        >
          {t("revolutImport.button")}
        </Button>
      </>
    );
  }

  return (
    <>
      {input}
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button
            leftSection={icon}
            rightSection={<IconChevronDown size={14} />}
            loading={isLoading}
            title={t("revolutImport.hint")}
            {...props}
          >
            {t("revolutImport.button")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("revolutImport.pickAccount")}</Menu.Label>
          {importable.map((a) => (
            <Menu.Item key={a.id} onClick={() => pick(a)}>
              {a.statementFormat
                ? t("revolutImport.accountOption", {
                    account: a.name,
                    format: t(`enum.statementFormat.${a.statementFormat}`),
                  })
                : a.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
