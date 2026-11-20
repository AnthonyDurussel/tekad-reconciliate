import { Button, FileButton, type ButtonProps } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileImport } from "@tabler/icons-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useImportRevolutStatementMutation } from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/format";

/** 10 Mo, comme l'API. */
const MAX_BYTES = 10_000_000;

/**
 * Import du relevé Revolut Business (Transactions → Relevé → CSV) :
 * l'abonnement n'ouvre pas l'API, le fichier la remplace. Réimporter un
 * relevé (ou un relevé qui chevauche le précédent) met à jour sans doublon.
 */
export default function RevolutImportButton(props: ButtonProps) {
  const { t } = useTranslation();
  const [importStatement, { isLoading }] = useImportRevolutStatementMutation();
  // Rechoisir le même fichier doit relancer l'import.
  const resetRef = useRef<() => void>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    resetRef.current?.();
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
      }).unwrap();
      notifications.show({
        color: result.errors.length ? "orange" : "teal",
        title: t("revolutImport.done", {
          count: result.created + result.updated,
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
        title: t("revolutImport.failed"),
        message: getErrorMessage(error),
      });
    }
  };

  return (
    <FileButton resetRef={resetRef} onChange={onFile} accept=".csv,text/csv">
      {(fileProps) => (
        <Button
          leftSection={<IconFileImport size={16} />}
          loading={isLoading}
          title={t("revolutImport.hint")}
          {...props}
          {...fileProps}
        >
          {t("revolutImport.button")}
        </Button>
      )}
    </FileButton>
  );
}
