import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Radio,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconExternalLink, IconLink, IconPaperclip } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { BexioExpenseDTO, ExpenseDTO } from "@repo/models";
import {
  useGetExpenseBexioCandidatesQuery,
  useLinkExpenseBexioMutation,
} from "@/store/slices/api";
import { getErrorMessage, isConflict } from "@/utils/apiError";
import { formatAmount, formatDate } from "@/utils/format";

/**
 * « Rattacher une dépense bexio » : les dépenses bexio non rattachées, payées
 * à ± 10 jours, les plus proches en tête (ordre de l'API). Le fichier de la
 * pièce y est joint et la dépense devient comptabilisée.
 */
export default function LinkBexioModal({
  expense,
  onClose,
}: {
  expense: ExpenseDTO | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      opened={expense !== null}
      onClose={onClose}
      title={t("expenseDetail.bexioModal.title")}
      size="xl"
    >
      {expense && (
        <LinkBexioBody key={expense.id} expense={expense} onClose={onClose} />
      )}
    </Modal>
  );
}

function LinkBexioBody({
  expense,
  onClose,
}: {
  expense: ExpenseDTO;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    data: candidates = [],
    isFetching,
    error,
  } = useGetExpenseBexioCandidatesQuery(expense.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [link, { isLoading }] = useLinkExpenseBexioMutation();
  const chosen = selected ?? candidates[0]?.id ?? null;

  const submit = async () => {
    if (!chosen) return;
    try {
      await link({
        id: expense.id,
        body: { bexioExpenseId: chosen },
      }).unwrap();
      notifications.show({
        color: "teal",
        message: t("expenseDetail.bexioCard.linkedDone"),
      });
      onClose();
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  if (error) {
    return (
      <Alert color={isConflict(error) ? "gray" : "red"} variant="light">
        {isConflict(error)
          ? t("expenseDetail.bexioModal.notConfigured")
          : getErrorMessage(error)}
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t("expenseDetail.bexioModal.hint", {
          subject: [
            formatDate(expense.date),
            formatAmount(expense.totalAmount, expense.currency),
          ].join(" · "),
        })}
      </Text>
      <ScrollArea.Autosize mah="55vh">
        <Radio.Group value={chosen} onChange={setSelected}>
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40} />
                <Table.Th>{t("bexioExpenses.paidOn")}</Table.Th>
                <Table.Th>{t("bexioExpenses.documentNo")}</Table.Th>
                <Table.Th>{t("bexioExpenses.vendor")}</Table.Th>
                <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
                <Table.Th>{t("bexioExpenses.paymentAccount")}</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  onSelect={() => setSelected(c.id)}
                />
              ))}
              {candidates.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      {isFetching
                        ? t("common.loading")
                        : t("expenseDetail.bexioModal.none")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Radio.Group>
      </ScrollArea.Autosize>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          leftSection={<IconLink size={16} />}
          disabled={!chosen}
          loading={isLoading}
          onClick={submit}
        >
          {t("expenseDetail.bexioModal.confirm")}
        </Button>
      </Group>
    </Stack>
  );
}

function CandidateRow({
  candidate: c,
  onSelect,
}: {
  candidate: BexioExpenseDTO;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Table.Tr style={{ cursor: "pointer" }} onClick={onSelect}>
      <Table.Td>
        <Radio value={c.id} aria-label={c.documentNo} />
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        {formatDate(c.paidOn)}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {c.documentNo}
        </Text>
        {c.status === "DRAFT" && (
          <Badge size="xs" variant="outline" color="gray">
            {t("bexioExpenses.draft")}
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={220}>
        <Text size="sm" fw={600} truncate>
          {c.vendor ?? c.title ?? "—"}
        </Text>
        {c.attachmentIds.length > 0 && (
          <Group gap={4} wrap="nowrap">
            <IconPaperclip size={12} />
            <Text size="xs" c="dimmed">
              {t("bexioExpenses.attached", { count: c.attachmentIds.length })}
            </Text>
          </Group>
        )}
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600}>
          {formatAmount(c.gross, c.currency)}
        </Text>
      </Table.Td>
      <Table.Td maw={180}>
        <Text size="sm" truncate>
          {c.paymentAccountName ?? c.bankAccountName ?? "—"}
        </Text>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Anchor
          href={`/bexio-expenses/${c.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t("expenseDetail.bexioCard.open")}
        >
          <IconExternalLink size={16} />
        </Anchor>
      </Table.Td>
    </Table.Tr>
  );
}
