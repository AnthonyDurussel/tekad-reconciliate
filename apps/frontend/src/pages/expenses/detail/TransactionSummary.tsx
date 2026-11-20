import { Badge, Group, Stack, Text } from "@mantine/core";
import type { RevolutTransactionDTO } from "@repo/models";
import { formatAmount, formatCard, formatDate } from "@/utils/format";

/** Une transaction Revolut sur deux lignes : commerçant, date, montants, carte. */
export default function TransactionSummary({
  transaction: tx,
}: {
  transaction: RevolutTransactionDTO;
}) {
  const foreign =
    tx.billAmount != null && tx.billCurrency && tx.billCurrency !== tx.currency;
  return (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600} truncate>
          {tx.merchantName ?? tx.description ?? tx.type}
        </Text>
        {tx.state !== "completed" && (
          <Badge size="xs" variant="light" color="yellow">
            {tx.state}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed">
        {formatDate(tx.date)} · {formatAmount(tx.amount, tx.currency)}
        {foreign ? ` (${formatAmount(tx.billAmount, tx.billCurrency)})` : ""}
        {tx.cardLast4 ? ` · ${formatCard(tx.cardLast4)}` : ""}
        {tx.merchantCity ? ` · ${tx.merchantCity}` : ""}
      </Text>
    </Stack>
  );
}
