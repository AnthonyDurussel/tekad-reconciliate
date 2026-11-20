import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLink, IconLinkOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  AUTO_MATCH_SCORE,
  ExpenseStatusDTO,
  type ExpenseDTO,
} from "@repo/models";
import {
  useGetExpenseCandidatesQuery,
  useMatchExpenseMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import TransactionSummary from "./TransactionSummary";

/**
 * Le rapprochement Revolut : la transaction rapprochée (« Détacher »), ou
 * les candidates classées par note avec leurs raisons (« Rapprocher »).
 */
export default function RevolutCard({
  expense,
  canManage,
}: {
  expense: ExpenseDTO;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const matched = expense.transaction ?? null;
  const locked = expense.status === ExpenseStatusDTO.BOOKED;
  const { data: candidates = [], isFetching } = useGetExpenseCandidatesQuery(
    expense.id,
    { skip: !!expense.transactionId },
  );
  const [match, { isLoading, originalArgs }] = useMatchExpenseMutation();

  const link = async (transactionId: string | null) => {
    try {
      await match({ id: expense.id, body: { transactionId } }).unwrap();
      notifications.show({
        color: "teal",
        message: transactionId
          ? t("expenseDetail.matchedDone")
          : t("expenseDetail.unmatchedDone"),
      });
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{t("expenseDetail.revolutTitle")}</Text>
          {expense.transactionId ? (
            <Badge
              color="teal"
              variant="light"
              leftSection={<IconLink size={12} />}
            >
              {t("expenses.matched")}
            </Badge>
          ) : (
            <Badge color="orange" variant="light">
              {t("expenses.notMatched")}
            </Badge>
          )}
        </Group>
        {expense.transactionId ? (
          <Group justify="space-between" wrap="nowrap" align="center">
            {matched ? (
              <TransactionSummary transaction={matched} />
            ) : (
              <Text size="sm" c="dimmed">
                {expense.transactionId}
              </Text>
            )}
            {canManage && (
              <Tooltip label={t("expenseDetail.lockedHint")} disabled={!locked}>
                <Button
                  size="xs"
                  variant="default"
                  color="red"
                  leftSection={<IconLinkOff size={14} />}
                  disabled={locked}
                  loading={isLoading}
                  onClick={() => link(null)}
                >
                  {t("expenseDetail.unmatch")}
                </Button>
              </Tooltip>
            )}
          </Group>
        ) : candidates.length === 0 ? (
          <Text size="sm" c="dimmed">
            {isFetching ? t("common.loading") : t("expenseDetail.noCandidates")}
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              {t("expenseDetail.candidatesHint", { score: AUTO_MATCH_SCORE })}
            </Text>
            {candidates.map(({ transaction, score, reasons }) => (
              <Card key={transaction.id} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap" align="center">
                  <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
                    <TransactionSummary transaction={transaction} />
                    <Group gap={4}>
                      {reasons.map((reason) => (
                        <Badge
                          key={reason}
                          size="xs"
                          variant="light"
                          color={reason === "otherCard" ? "red" : "gray"}
                        >
                          {t(`expenseDetail.reasons.${reason}`, {
                            defaultValue: reason,
                          })}
                        </Badge>
                      ))}
                      {transaction.expenseId && (
                        <Badge size="xs" variant="outline" color="orange">
                          {t("expenseDetail.alreadyMatched")}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                  <Stack gap={6} align="flex-end" w={130}>
                    <Group gap={6} wrap="nowrap" w="100%">
                      <Progress
                        value={score}
                        color={score >= AUTO_MATCH_SCORE ? "teal" : "orange"}
                        style={{ flex: 1 }}
                      />
                      <Text size="xs" fw={700}>
                        {score}
                      </Text>
                    </Group>
                    {canManage && (
                      <Button
                        size="xs"
                        leftSection={<IconLink size={14} />}
                        disabled={locked}
                        loading={
                          isLoading &&
                          originalArgs?.body.transactionId === transaction.id
                        }
                        onClick={() => link(transaction.id)}
                      >
                        {t("expenseDetail.match")}
                      </Button>
                    )}
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
