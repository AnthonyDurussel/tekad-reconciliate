import { useState, type ReactNode } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconExternalLink,
  IconLink,
  IconLinkOff,
  IconPaperclip,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ExpenseStatusDTO,
  type BexioExpenseDetailDTO,
  type ExpenseDTO,
} from "@repo/models";
import {
  bexioExpenseFileUrl,
  useGetBexioExpenseQuery,
  useUnlinkExpenseBexioMutation,
} from "@/store/slices/api";
import { getErrorMessage, isConflict } from "@/utils/apiError";
import { formatAmount, formatDate } from "@/utils/format";
import LinkBexioModal from "./LinkBexioModal";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <div style={{ fontSize: "var(--mantine-font-size-sm)" }}>{children}</div>
    </Stack>
  );
}

/**
 * La dépense bexio rattachée, lue en direct (n°, fournisseur, montant,
 * comptes, rapprochement bancaire, fichiers joints ; « Détacher »), sinon
 * « Rattacher une dépense bexio » — « Comptabiliser » la crée.
 */
export default function BexioCard({
  expense,
  canManage,
}: {
  expense: ExpenseDTO;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);
  const linkedId = expense.bexioExpenseId;
  const {
    data: detail,
    error,
    isFetching,
  } = useGetBexioExpenseQuery(linkedId ?? "", { skip: !linkedId });
  const [unlink, { isLoading: unlinking }] = useUnlinkExpenseBexioMutation();
  const ignored = expense.status === ExpenseStatusDTO.IGNORED;

  const confirmUnlink = () =>
    modals.openConfirmModal({
      title: t("expenseDetail.bexioCard.unlinkTitle"),
      children: (
        <Text size="sm">
          {t("expenseDetail.bexioCard.unlinkConfirm", {
            no: detail?.documentNo ?? linkedId,
          })}
        </Text>
      ),
      labels: {
        confirm: t("expenseDetail.bexioCard.unlink"),
        cancel: t("common.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await unlink(expense.id).unwrap();
          notifications.show({
            color: "teal",
            message: t("expenseDetail.bexioCard.unlinkedDone"),
          });
        } catch (e) {
          notifications.show({ color: "red", message: getErrorMessage(e) });
        }
      },
    });

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>{t("expenseDetail.bexioCard.title")}</Text>
          {linkedId || expense.bexioEntryId ? (
            <Badge color="teal" variant="light">
              {t("expenseDetail.bexioCard.inBexio")}
            </Badge>
          ) : (
            !ignored && (
              <Badge color="red" variant="light">
                {t("enum.expenseIssue.NOT_IN_BEXIO")}
              </Badge>
            )
          )}
        </Group>
        {linkedId ? (
          <>
            {detail ? (
              <BexioDetail detail={detail} />
            ) : (
              <Alert color={error ? "orange" : "gray"} variant="light">
                {isFetching
                  ? t("common.loading")
                  : error && isConflict(error)
                    ? t("expenseDetail.bexioCard.notConfigured")
                    : t("expenseDetail.bexioCard.unavailable", {
                        id: linkedId,
                        message: error ? getErrorMessage(error) : "—",
                      })}
              </Alert>
            )}
            <Group gap="sm">
              <Button
                component={Link}
                to={`/bexio-expenses/${linkedId}`}
                size="xs"
                variant="default"
                leftSection={<IconExternalLink size={14} />}
              >
                {t("expenseDetail.bexioCard.open")}
              </Button>
              {canManage && (
                <Button
                  size="xs"
                  variant="default"
                  color="red"
                  leftSection={<IconLinkOff size={14} />}
                  loading={unlinking}
                  onClick={confirmUnlink}
                >
                  {t("expenseDetail.bexioCard.unlink")}
                </Button>
              )}
            </Group>
          </>
        ) : expense.bexioEntryId ? (
          <Text size="sm">
            {t("expenseDetail.bexioCard.entry", { id: expense.bexioEntryId })}
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              {t("expenseDetail.bexioCard.noneHint")}
            </Text>
            {canManage && !ignored && (
              <Group>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconLink size={14} />}
                  onClick={() => setLinking(true)}
                >
                  {t("expenseDetail.bexioCard.link")}
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>
      <LinkBexioModal
        expense={linking ? expense : null}
        onClose={() => setLinking(false)}
      />
    </Card>
  );
}

function BexioDetail({ detail }: { detail: BexioExpenseDetailDTO }) {
  const { t } = useTranslation();
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <Field label={t("bexioExpenses.documentNo")}>
          <Group gap={6}>
            <Text size="sm" ff="monospace" fw={600}>
              {detail.documentNo}
            </Text>
            {detail.status === "DRAFT" && (
              <Badge size="xs" variant="outline" color="gray">
                {t("bexioExpenses.draft")}
              </Badge>
            )}
          </Group>
        </Field>
        <Field label={t("bexioExpenses.vendor")}>
          {detail.vendor ?? detail.title ?? "—"}
        </Field>
        <Field label={t("expenses.amount")}>
          <Text size="sm" fw={600}>
            {formatAmount(detail.gross, detail.currency)}
          </Text>
        </Field>
        <Field label={t("bexioExpenses.paidOn")}>
          {formatDate(detail.paidOn)}
        </Field>
        <Field label={t("bexioExpenses.bookingAccount")}>
          {detail.bookingAccountNo
            ? `${detail.bookingAccountNo} ${detail.bookingAccountName ?? ""}`
            : "—"}
        </Field>
        <Field label={t("bexioExpenses.paymentAccount")}>
          {detail.bankAccountNo
            ? `${detail.bankAccountNo} ${detail.bankAccountName ?? ""}`
            : "—"}
        </Field>
      </SimpleGrid>
      <Group gap="sm">
        <Badge variant="light" color={detail.bexioReconciled ? "teal" : "gray"}>
          {detail.bexioReconciled
            ? t("bexioExpenses.reconciledInBexio")
            : t("bexioExpenses.notReconciledInBexio")}
        </Badge>
      </Group>
      <Stack gap={4}>
        {detail.attachments.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("bexioExpenses.noAttachment")}
          </Text>
        ) : (
          detail.attachments.map((a, i) => (
            <Group key={a.uuid} gap={6} wrap="nowrap">
              <IconPaperclip size={14} />
              <Anchor
                href={bexioExpenseFileUrl(detail.id, a.uuid)}
                target="_blank"
                rel="noreferrer"
                size="sm"
              >
                {a.name ?? t("bexioExpenseDetail.preview.file", { n: i + 1 })}
              </Anchor>
            </Group>
          ))
        )}
      </Stack>
    </Stack>
  );
}
