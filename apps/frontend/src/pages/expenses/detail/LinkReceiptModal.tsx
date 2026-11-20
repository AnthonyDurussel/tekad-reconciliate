import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLink, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ExpenseDTO } from "@repo/models";
import {
  receiptFileUrl,
  useGetExpenseReceiptCandidatesQuery,
  useLinkExpenseReceiptMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatAmount, formatDate } from "@/utils/format";
import { matchesReceiptSearch, rankReceipts } from "../expenseLinks";
import { FilePreview } from "./ReceiptPreview";

/**
 * « Rattacher une pièce » : les pièces sans dépense, ou seules sur leur
 * dépense (qui disparaît une fois la pièce rattachée), les plus proches du
 * montant en tête ; l'aperçu de la pièce choisie à droite.
 */
export default function LinkReceiptModal({
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
      title={t("expenseDetail.receiptModal.title")}
      size="80rem"
    >
      {expense && (
        <LinkReceiptBody key={expense.id} expense={expense} onClose={onClose} />
      )}
    </Modal>
  );
}

function LinkReceiptBody({
  expense,
  onClose,
}: {
  expense: ExpenseDTO;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data: receipts = [], isFetching } =
    useGetExpenseReceiptCandidatesQuery(expense.id);
  const [link, { isLoading }] = useLinkExpenseReceiptMutation();
  const ranked = useMemo(
    () =>
      rankReceipts(expense, receipts).filter(({ receipt }) =>
        matchesReceiptSearch(receipt, search),
      ),
    [expense, receipts, search],
  );
  const current =
    ranked.find(({ receipt }) => receipt.id === selected)?.receipt ??
    ranked[0]?.receipt ??
    null;

  const submit = async () => {
    if (!current) return;
    try {
      await link({
        id: expense.id,
        body: { receiptId: current.id },
      }).unwrap();
      notifications.show({
        color: "teal",
        message: t("expenseDetail.receiptCard.linkedDone"),
      });
      onClose();
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t("expenseDetail.receiptModal.hint")}
      </Text>
      <TextInput
        placeholder={t("expenseDetail.receiptModal.search")}
        aria-label={t("expenseDetail.receiptModal.search")}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <ScrollArea.Autosize mah="60vh">
            <Stack gap={6}>
              {ranked.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  {isFetching
                    ? t("common.loading")
                    : t("expenseDetail.receiptModal.none")}
                </Text>
              )}
              {ranked.map(({ receipt, amountGap }) => {
                const active = current?.id === receipt.id;
                const x = receipt.extraction;
                return (
                  <UnstyledButton
                    key={receipt.id}
                    onClick={() => setSelected(receipt.id)}
                    aria-pressed={active}
                  >
                    <Card
                      withBorder
                      p="sm"
                      radius="md"
                      style={
                        active
                          ? {
                              borderColor:
                                "var(--mantine-primary-color-filled)",
                              background: "var(--mantine-primary-color-light)",
                            }
                          : undefined
                      }
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} truncate>
                            {x?.merchant ?? receipt.fileName}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {[formatDate(x?.date), receipt.fileName].join(
                              " · ",
                            )}
                          </Text>
                        </Stack>
                        <Text
                          size="sm"
                          fw={600}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {formatAmount(
                            x?.totalAmount ?? null,
                            x?.currency ?? null,
                          )}
                        </Text>
                      </Group>
                      <Group gap={4} mt={4}>
                        {amountGap === 0 && (
                          <Badge size="xs" variant="light" color="teal">
                            {t("expenseDetail.receiptModal.sameAmount")}
                          </Badge>
                        )}
                        {!receipt.extractedAt && (
                          <Badge size="xs" variant="light" color="gray">
                            {t("expenseDetail.receiptModal.notRead")}
                          </Badge>
                        )}
                        {receipt.expenseId && (
                          <Badge size="xs" variant="outline" color="orange">
                            {t("expenseDetail.receiptModal.ownExpense")}
                          </Badge>
                        )}
                      </Group>
                    </Card>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          {current ? (
            <Card withBorder p={0}>
              <FilePreview
                key={current.id}
                url={receiptFileUrl(current.id)}
                name={current.fileName}
                mimeType={current.mimeType}
                height="60vh"
              />
            </Card>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {t("expenseDetail.receiptModal.previewHint")}
            </Text>
          )}
        </Grid.Col>
      </Grid>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          leftSection={<IconLink size={16} />}
          disabled={!current}
          loading={isLoading}
          onClick={submit}
        >
          {t("expenseDetail.receiptModal.confirm")}
        </Button>
      </Group>
    </Stack>
  );
}
