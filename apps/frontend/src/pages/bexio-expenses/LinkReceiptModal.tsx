import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconExternalLink, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { BexioExpenseDTO } from "@repo/models";
import {
  expenseFileUrl,
  useGetExpensesQuery,
  useLinkBexioExpenseMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatAmount, formatChfPrecise, formatDate } from "@/utils/format";
import type { Period } from "@/utils/period";
import {
  CANDIDATE_DAYS,
  candidateWindow,
  matchesCandidateSearch,
  rankCandidates,
} from "./bexioExpenses";

/**
 * « Lier une pièce » : les pièces autour de la date de paiement (±10 jours),
 * ni ignorées ni déjà liées, les plus proches du montant en tête. Lier joint
 * le fichier de la pièce à la dépense dans bexio.
 */
export default function LinkReceiptModal({
  bexioExpense,
  period,
  onClose,
}: {
  bexioExpense: BexioExpenseDTO | null;
  /** Fenêtre de repli quand la dépense n'a pas de date de paiement. */
  period: Period;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      opened={bexioExpense !== null}
      onClose={onClose}
      title={t("bexioExpenses.link.title")}
      size="xl"
    >
      {bexioExpense && (
        <LinkReceiptBody
          // Une autre dépense : recherche remise à zéro.
          key={bexioExpense.id}
          bexioExpense={bexioExpense}
          period={period}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function LinkReceiptBody({
  bexioExpense,
  period,
  onClose,
}: {
  bexioExpense: BexioExpenseDTO;
  period: Period;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const range = candidateWindow(bexioExpense.paidOn, period);
  const { data: expenses = [], isFetching } = useGetExpensesQuery(range);
  const [link, { isLoading, originalArgs }] = useLinkBexioExpenseMutation();
  const candidates = useMemo(
    () =>
      rankCandidates(bexioExpense, expenses).filter((c) =>
        matchesCandidateSearch(c.expense, search),
      ),
    [bexioExpense, expenses, search],
  );

  const doLink = async (expenseId: string) => {
    try {
      await link({ id: bexioExpense.id, body: { expenseId } }).unwrap();
      notifications.show({
        color: "teal",
        message: t("bexioExpenses.link.done"),
      });
      onClose();
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        {t("bexioExpenses.link.subject", {
          no: bexioExpense.documentNo,
          vendor: bexioExpense.vendor ?? bexioExpense.title ?? "—",
          date: formatDate(bexioExpense.paidOn),
          amount: formatAmount(bexioExpense.gross, bexioExpense.currency),
        })}
      </Text>
      <Text size="xs" c="dimmed">
        {t("bexioExpenses.link.hint", {
          from: formatDate(range.from),
          to: formatDate(range.to),
          days: CANDIDATE_DAYS,
        })}
      </Text>
      <TextInput
        placeholder={t("bexioExpenses.link.search")}
        aria-label={t("bexioExpenses.link.search")}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        data-autofocus
      />
      <ScrollArea.Autosize mah={420}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("bexioExpenses.link.receipt")}</Table.Th>
              <Table.Th>{t("expenses.date")}</Table.Th>
              <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
              <Table.Th>{t("expenses.account")}</Table.Th>
              <Table.Th w={130} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {candidates.map(({ expense: e, amountGap }) => (
              <Table.Tr key={e.id}>
                <Table.Td maw={260}>
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" fw={600} truncate>
                      {e.merchant ?? e.fileName}
                    </Text>
                    {amountGap === 0 && (
                      <Badge size="xs" color="teal" variant="light">
                        {t("bexioExpenses.link.sameAmount")}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {e.fileName}
                  </Text>
                </Table.Td>
                <Table.Td style={{ whiteSpace: "nowrap" }}>
                  {formatDate(e.date)}
                </Table.Td>
                <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
                  <Text size="sm">
                    {formatAmount(e.totalAmount, e.currency)}
                  </Text>
                  {e.currency !== "CHF" && e.booking.amountChf !== null && (
                    <Text size="xs" c="dimmed">
                      {formatChfPrecise(e.booking.amountChf)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{e.paymentAccountName ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    <Tooltip label={t("bexioExpenses.link.preview")}>
                      <ActionIcon
                        component="a"
                        href={expenseFileUrl(e.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtle"
                        color="gray"
                        aria-label={t("bexioExpenses.link.preview")}
                      >
                        <IconExternalLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Button
                      size="xs"
                      loading={
                        isLoading && originalArgs?.body.expenseId === e.id
                      }
                      disabled={isLoading}
                      onClick={() => doLink(e.id)}
                    >
                      {t("bexioExpenses.link.confirm")}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {candidates.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md" size="sm">
                    {isFetching
                      ? t("common.loading")
                      : t("bexioExpenses.link.none")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
    </Stack>
  );
}
