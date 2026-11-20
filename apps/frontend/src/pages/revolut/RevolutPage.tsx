import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBan,
  IconCopy,
  IconCreditCard,
  IconReceiptOff,
  IconRestore,
  IconSearch,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  PermissionDTO,
  type PaymentAccountDTO,
  type RevolutTransactionDTO,
  type RevolutTransactionQueryDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import IgnoreModal from "@/components/expense/IgnoreModal";
import usePermissions from "@/hooks/usePermissions";
import {
  useGetPaymentAccountsQuery,
  useGetRevolutTransactionsQuery,
  useIgnoreRevolutTransactionMutation,
  useRestoreRevolutTransactionMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatAmount, formatCard, formatDate } from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";
import {
  merchantOf,
  missingReceiptsText,
  totalsByCurrency,
} from "./missingReceipts";

type Tab = NonNullable<RevolutTransactionQueryDTO["filter"]>;
const TABS: Tab[] = ["all", "missing", "matched", "ignored"];

/**
 * Les transactions Revolut Business. L'onglet « Pièces manquantes » liste les
 * sorties sans pièce ni dispense : ce qu'il faut demander, à copier d'un clic.
 */
export default function RevolutPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can(PermissionDTO.EXPENSE_MANAGE);
  const [params, setParams] = useSearchParams();
  const setParam = (patch: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  const tab: Tab = TABS.includes(params.get("tab") as Tab)
    ? (params.get("tab") as Tab)
    : "all";
  const period = useMemo<Period>(() => {
    const from = params.get("from");
    const to = params.get("to");
    return from && to ? { from, to } : lastThreeMonths();
  }, [params]);
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const pushSearch = useDebouncedCallback(
    (value: string) => setParam({ search: value.trim() || null }),
    300,
  );
  const { data: transactions = [], isFetching } =
    useGetRevolutTransactionsQuery({
      ...period,
      filter: tab,
      search: searchParam || undefined,
    });
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const [ignore, { isLoading: ignoring }] =
    useIgnoreRevolutTransactionMutation();
  const [restore] = useRestoreRevolutTransactionMutation();
  const [ignoring_, setIgnoring] = useState<RevolutTransactionDTO | null>(null);

  const totals = totalsByCurrency(transactions);

  const copyList = async () => {
    const text = missingReceiptsText(
      transactions,
      t("revolut.copyHeading", {
        from: formatDate(period.from),
        to: formatDate(period.to),
        count: transactions.length,
      }),
    );
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: "teal", message: t("revolut.copied") });
    } catch {
      notifications.show({ color: "red", message: t("revolut.copyFailed") });
    }
  };

  const doRestore = async (tx: RevolutTransactionDTO) => {
    try {
      await restore(tx.id).unwrap();
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  return (
    <Page maxWidth={1500}>
      <PageHeader
        icon={<IconCreditCard size={22} stroke={1.7} />}
        title={t("revolut.title")}
        subtitle={t("revolut.subtitle")}
        count={transactions.length}
      />
      <Group gap="sm" mb="md" align="flex-end" wrap="wrap">
        <PeriodPicker
          value={period}
          onChange={(p) => setParam({ from: p.from, to: p.to })}
        />
        <TextInput
          placeholder={t("revolut.search")}
          aria-label={t("revolut.search")}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            pushSearch(e.currentTarget.value);
          }}
          w={260}
        />
      </Group>
      <Tabs
        value={tab}
        onChange={(v) => setParam({ tab: v === "all" ? null : v })}
        mb="md"
      >
        <Tabs.List>
          {TABS.map((key) => (
            <Tabs.Tab
              key={key}
              value={key}
              leftSection={
                key === "missing" ? <IconReceiptOff size={16} /> : undefined
              }
            >
              {t(`revolut.tabs.${key}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {tab === "missing" && (
        <Alert
          color={transactions.length ? "red" : "teal"}
          variant="light"
          mb="md"
          icon={<IconReceiptOff size={18} />}
          title={t("revolut.missingTitle", { count: transactions.length })}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text size="sm">
              {transactions.length
                ? t("revolut.missingText", { total: totals.join(" · ") })
                : t("revolut.missingNone")}
            </Text>
            {transactions.length > 0 && (
              <Button
                size="xs"
                variant="white"
                leftSection={<IconCopy size={14} />}
                onClick={copyList}
              >
                {t("revolut.copy")}
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1000}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("expenses.date")}</Table.Th>
                <Table.Th>{t("expenses.merchant")}</Table.Th>
                <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
                <Table.Th>{t("expenses.card")}</Table.Th>
                <Table.Th>{t("expenses.account")}</Table.Th>
                <Table.Th>{t("revolut.receipt")}</Table.Th>
                {canManage && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  accounts={accounts}
                  canManage={canManage}
                  onIgnore={() => setIgnoring(tx)}
                  onRestore={() => doRestore(tx)}
                />
              ))}
              {transactions.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={canManage ? 7 : 6}>
                    <Text c="dimmed" ta="center" py="lg">
                      {isFetching ? t("common.loading") : t("revolut.empty")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {transactions.length > 0 && tab !== "missing" && (
        <Text size="sm" c="dimmed" mt="sm">
          {t("revolut.total", { total: totals.join(" · ") })}
        </Text>
      )}
      <IgnoreModal
        opened={ignoring_ !== null}
        title={t("revolut.ignoreTitle")}
        description={
          ignoring_
            ? `${formatDate(ignoring_.date)} — ${merchantOf(ignoring_)} — ${formatAmount(ignoring_.amount, ignoring_.currency)}`
            : undefined
        }
        suggestions={[
          t("revolut.ignoreReasons.bankFee"),
          t("revolut.ignoreReasons.transfer"),
          t("revolut.ignoreReasons.salary"),
          t("revolut.ignoreReasons.tax"),
        ]}
        loading={ignoring}
        onClose={() => setIgnoring(null)}
        onConfirm={async (reason) => {
          if (!ignoring_) return;
          try {
            await ignore({ id: ignoring_.id, body: { reason } }).unwrap();
            setIgnoring(null);
          } catch (error) {
            notifications.show({
              color: "red",
              message: getErrorMessage(error),
            });
          }
        }}
      />
    </Page>
  );
}

function TransactionRow({
  tx,
  accounts,
  canManage,
  onIgnore,
  onRestore,
}: {
  tx: RevolutTransactionDTO;
  accounts: PaymentAccountDTO[];
  canManage: boolean;
  onIgnore: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const account = accounts.find((a) => a.id === tx.paymentAccountId);
  const foreign =
    tx.billAmount != null && tx.billCurrency && tx.billCurrency !== tx.currency;
  return (
    <Table.Tr style={tx.ignored ? { opacity: 0.6 } : undefined}>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        {formatDate(tx.date)}
      </Table.Td>
      <Table.Td maw={320}>
        <Text size="sm" fw={600} truncate>
          {merchantOf(tx)}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {[
            tx.merchantCity,
            tx.mcc ? `MCC ${tx.mcc}` : null,
            t(`revolut.type.${tx.type}`, { defaultValue: tx.type }),
            tx.state !== "completed" ? tx.state : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600} c={tx.amount < 0 ? undefined : "teal"}>
          {formatAmount(tx.amount, tx.currency)}
        </Text>
        {foreign && (
          <Text size="xs" c="dimmed">
            {formatAmount(tx.billAmount, tx.billCurrency)}
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {formatCard(tx.cardLast4)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{account?.name ?? "—"}</Text>
      </Table.Td>
      <Table.Td>
        {tx.expenseId ? (
          <Anchor component={Link} to={`/expenses/${tx.expenseId}`} size="sm">
            {t("revolut.openReceipt")}
          </Anchor>
        ) : tx.ignored ? (
          <Stack gap={0}>
            <Badge size="sm" variant="light" color="gray">
              {t("revolut.ignored")}
            </Badge>
            {tx.ignoreReason && (
              <Text size="xs" c="dimmed">
                {tx.ignoreReason}
              </Text>
            )}
          </Stack>
        ) : tx.requiresReceipt ? (
          <Badge size="sm" variant="light" color="red">
            {t("revolut.missing")}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            {t("revolut.notRequired")}
          </Text>
        )}
      </Table.Td>
      {canManage && (
        <Table.Td>
          {tx.ignored ? (
            <Tooltip label={t("revolut.restore")}>
              <ActionIcon
                variant="subtle"
                onClick={onRestore}
                aria-label={t("revolut.restore")}
              >
                <IconRestore size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            !tx.expenseId && (
              <Tooltip label={t("revolut.ignore")}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={onIgnore}
                  aria-label={t("revolut.ignore")}
                >
                  <IconBan size={16} />
                </ActionIcon>
              </Tooltip>
            )
          )}
        </Table.Td>
      )}
    </Table.Tr>
  );
}
