import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useCreateExpenseFromBexioMutation,
  useCreateExpenseFromTransactionMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";

/**
 * « Créer la dépense » depuis une dépense bexio ou une sortie du relevé :
 * crée (ou reprend) la dépense de l'application, puis l'ouvre.
 */
export default function useCreateExpense() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fromBexio, bexioState] = useCreateExpenseFromBexioMutation();
  const [fromTransaction, transactionState] =
    useCreateExpenseFromTransactionMutation();

  const open = async (create: () => Promise<{ id: string }>) => {
    try {
      const expense = await create();
      notifications.show({
        color: "teal",
        message: t("expenses.createdDone"),
      });
      navigate(`/expenses/${expense.id}`);
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  return {
    fromBexio: (bexioExpenseId: string) =>
      open(() => fromBexio({ bexioExpenseId }).unwrap()),
    fromTransaction: (transactionId: string) =>
      open(() => fromTransaction({ transactionId }).unwrap()),
    /** L'id en cours de création (bouton en chargement). */
    pendingBexioId: bexioState.isLoading
      ? bexioState.originalArgs?.bexioExpenseId
      : undefined,
    pendingTransactionId: transactionState.isLoading
      ? transactionState.originalArgs?.transactionId
      : undefined,
  };
}
