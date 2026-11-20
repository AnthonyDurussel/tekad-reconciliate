import {
  Alert,
  Badge,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ExpenseStatusDTO, type ExpenseDTO } from "@repo/models";
import { formatChfPrecise, formatDate, formatDateTime } from "@/utils/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Stack>
  );
}

/** L'écriture proposée (ou passée) dans bexio, et ce qui lui manque. */
export default function BookingCard({ expense }: { expense: ExpenseDTO }) {
  const { t } = useTranslation();
  const { booking } = expense;
  const booked = expense.status === ExpenseStatusDTO.BOOKED;
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>
            {booked
              ? t("expenseDetail.bookingDone")
              : t("expenseDetail.bookingProposal")}
          </Text>
          <Group gap={6} wrap="nowrap">
            {expense.bexioExpenseId && (
              <Tooltip
                label={t("expenseDetail.bexioExpenseHint", {
                  id: expense.bexioExpenseId,
                })}
              >
                <Badge variant="light" color="teal">
                  {t("expenseDetail.bexioExpense")}
                </Badge>
              </Tooltip>
            )}
            {booking.mode && (
              <Badge variant="light" color="gray">
                {t(`enum.bookingMode.${booking.mode}`)}
              </Badge>
            )}
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Field label={t("expenses.date")} value={formatDate(booking.date)} />
          <Field
            label={t("expenseDetail.amountChf")}
            value={formatChfPrecise(booking.amountChf)}
          />
          <Field
            label={t("expenseDetail.vatRate")}
            value={booking.vatRate != null ? `${booking.vatRate} %` : "—"}
          />
          <Field
            label={t("expenseDetail.debit")}
            value={booking.debitAccountNo ?? "—"}
          />
          <Field
            label={t("expenseDetail.credit")}
            value={booking.creditAccountNo ?? "—"}
          />
          <Field
            label={t("expenseDetail.taxId")}
            value={booking.bexioTaxId ?? t("expenseDetail.noTax")}
          />
        </SimpleGrid>
        <Field
          label={t("expenseDetail.description")}
          value={booking.description || "—"}
        />
        {booked ? (
          <Alert
            color="teal"
            variant="light"
            icon={<IconCircleCheck size={16} />}
          >
            {expense.bexioEntryId
              ? t("expenseDetail.bookedEntry", {
                  id: expense.bexioEntryId,
                  date: formatDateTime(expense.bookedAt),
                })
              : t("expenseDetail.bookedReconciliation", {
                  date: formatDateTime(expense.bookedAt),
                })}
          </Alert>
        ) : booking.missing.length > 0 ? (
          <Alert
            color="orange"
            variant="light"
            icon={<IconInfoCircle size={16} />}
            title={t("expenseDetail.missingTitle")}
          >
            <List size="sm" spacing={2}>
              {booking.missing.map((code) => (
                <List.Item key={code}>
                  {t(`expenseDetail.missing.${code}`, { defaultValue: code })}
                </List.Item>
              ))}
            </List>
          </Alert>
        ) : (
          <Text size="sm" c="teal">
            {t("expenseDetail.readyToBook")}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
