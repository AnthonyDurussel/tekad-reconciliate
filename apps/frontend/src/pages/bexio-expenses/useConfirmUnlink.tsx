import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import type { BexioExpenseDTO } from "@repo/models";
import { useUnlinkBexioExpenseMutation } from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";

/**
 * « Délier la pièce » après confirmation : le lien local seulement, le
 * fichier reste joint à la dépense dans bexio.
 */
export default function useConfirmUnlink() {
  const { t } = useTranslation();
  const [unlink] = useUnlinkBexioExpenseMutation();
  return (
    row: Pick<BexioExpenseDTO, "id" | "documentNo" | "expenseFileName">,
  ) =>
    modals.openConfirmModal({
      title: t("bexioExpenses.unlink.title"),
      children: (
        <Text size="sm">
          {t("bexioExpenses.unlink.confirm", {
            file: row.expenseFileName ?? "—",
            no: row.documentNo,
          })}
        </Text>
      ),
      labels: {
        confirm: t("bexioExpenses.unlink.action"),
        cancel: t("common.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await unlink(row.id).unwrap();
          notifications.show({
            color: "teal",
            message: t("bexioExpenses.unlink.done"),
          });
        } catch (e) {
          notifications.show({ color: "red", message: getErrorMessage(e) });
        }
      },
    });
}
