import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import {
  IconFileSpreadsheet,
  IconLink,
  IconLinkOff,
  IconReceipt,
  IconSearch,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ExpenseStatusDTO,
  PaymentAccountKindDTO,
  type ExpenseDTO,
  type ExpenseQueryDTO,
  type PaymentAccountDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import AccountBadge from "@/components/expense/AccountBadge";
import ExpenseStatusBadge from "@/components/expense/ExpenseStatusBadge";
import {
  expensesExportUrl,
  useGetExpenseCategoriesQuery,
  useGetExpensesQuery,
  useGetPaymentAccountsQuery,
} from "@/store/slices/api";
import { enumOptions } from "@/utils/enumOptions";
import {
  formatAmount,
  formatCard,
  formatChfPrecise,
  formatDate,
} from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";

/** Valeur des filtres « compte » et « type » pour « non renseigné ». */
const NONE = "none";

/**
 * Les pièces importées de l'inbox bexio. Filtres dans l'URL (période,
 * compte de paiement, type de dépense, statut, recherche) : le retour depuis
 * le détail d'une pièce les retrouve ; l'export Excel les reprend.
 */
export default function ExpensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const period = useMemo<Period>(() => {
    const from = params.get("from");
    const to = params.get("to");
    return from && to ? { from, to } : lastThreeMonths();
  }, [params]);
  const accountId = params.get("account");
  const categoryId = params.get("category");
  const status = params.get("status") as ExpenseStatusDTO | null;
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const pushSearch = useDebouncedCallback(
    (value: string) => setParam({ search: value.trim() || null }),
    300,
  );

  const query: ExpenseQueryDTO = {
    ...period,
    paymentAccountId: accountId ?? undefined,
    categoryId: categoryId ?? undefined,
    status: status ?? undefined,
    search: searchParam || undefined,
  };
  const { data: expenses = [], isFetching } = useGetExpensesQuery(query);
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const { data: categories = [] } = useGetExpenseCategoriesQuery();

  const activeAccounts = accounts.filter((a) => a.active || a.id === accountId);
  const quickFilter = [
    { value: "", label: t("expenses.allAccounts") },
    ...activeAccounts.map((a) => ({ value: a.id, label: a.name })),
    { value: NONE, label: t("expenses.unclassified") },
  ];
  const categoryOptions = [
    { value: NONE, label: t("expenses.noCategory") },
    ...categories
      .filter((c) => c.active || c.id === categoryId)
      .map((c) => ({ value: c.id, label: `${c.label} (${c.bexioAccountNo})` })),
  ];

  const totals = useMemo(() => {
    const priced = expenses.filter((e) => e.booking.amountChf !== null);
    return {
      chf: priced.reduce((sum, e) => sum + (e.booking.amountChf ?? 0), 0),
      unpriced: expenses.length - priced.length,
    };
  }, [expenses]);

  const open = (id: string) =>
    navigate(`/expenses/${id}`, { state: { back: location.search } });

  return (
    <Page maxWidth={1500}>
      <PageHeader
        icon={<IconReceipt size={22} stroke={1.7} />}
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        count={expenses.length}
        actions={
          <Button
            component="a"
            href={expensesExportUrl(query)}
            variant="default"
            leftSection={<IconFileSpreadsheet size={16} />}
          >
            {t("expenses.export")}
          </Button>
        }
      />
      <Stack gap="md" mb="md">
        <SegmentedControl
          data={quickFilter}
          value={accountId ?? ""}
          onChange={(v) => setParam({ account: v || null })}
          style={{ alignSelf: "flex-start", maxWidth: "100%" }}
          styles={{ root: { overflowX: "auto" } }}
        />
        <Group gap="sm" align="flex-end" wrap="wrap">
          <PeriodPicker
            value={period}
            onChange={(p) => setParam({ from: p.from, to: p.to })}
          />
          <Select
            placeholder={t("expenses.allAccounts")}
            aria-label={t("expenses.account")}
            data={[
              ...activeAccounts.map((a) => ({ value: a.id, label: a.name })),
              { value: NONE, label: t("expenses.unclassified") },
            ]}
            value={accountId}
            onChange={(v) => setParam({ account: v })}
            clearable
            w={210}
          />
          <Select
            placeholder={t("expenses.allCategories")}
            aria-label={t("expenses.category")}
            data={categoryOptions}
            value={categoryId}
            onChange={(v) => setParam({ category: v })}
            clearable
            searchable
            w={240}
          />
          <Select
            placeholder={t("expenses.allStatuses")}
            aria-label={t("expenses.status")}
            data={enumOptions(t, "expenseStatus", ExpenseStatusDTO)}
            value={status}
            onChange={(v) => setParam({ status: v })}
            clearable
            w={170}
          />
          <TextInput
            placeholder={t("expenses.search")}
            aria-label={t("expenses.search")}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              pushSearch(e.currentTarget.value);
            }}
            w={240}
          />
        </Group>
      </Stack>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1100}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("expenses.date")}</Table.Th>
                <Table.Th>{t("expenses.merchant")}</Table.Th>
                <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
                <Table.Th>{t("expenses.card")}</Table.Th>
                <Table.Th>{t("expenses.account")}</Table.Th>
                <Table.Th>{t("expenses.category")}</Table.Th>
                <Table.Th>{t("expenses.booking")}</Table.Th>
                <Table.Th>{t("expenses.status")}</Table.Th>
                <Table.Th w={60} ta="center">
                  {t("expenses.revolut")}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {expenses.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  accounts={accounts}
                  onOpen={() => open(e.id)}
                />
              ))}
              {expenses.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text c="dimmed" ta="center" py="lg">
                      {isFetching ? t("common.loading") : t("expenses.empty")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            {expenses.length > 0 && (
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={2}>
                    {t("expenses.total", { count: expenses.length })}
                  </Table.Th>
                  <Table.Th ta="right">{formatChfPrecise(totals.chf)}</Table.Th>
                  <Table.Th colSpan={6}>
                    {totals.unpriced > 0 && (
                      <Text size="xs" c="dimmed" fw={400}>
                        {t("expenses.unpriced", { count: totals.unpriced })}
                      </Text>
                    )}
                  </Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Page>
  );
}

function ExpenseRow({
  expense: e,
  accounts,
  onOpen,
}: {
  expense: ExpenseDTO;
  accounts: PaymentAccountDTO[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const account = accounts.find((a) => a.id === e.paymentAccountId);
  const isRevolut = account?.kind === PaymentAccountKindDTO.REVOLUT;
  const { debitAccountNo, creditAccountNo } = e.booking;
  return (
    <Table.Tr
      style={{ cursor: "pointer" }}
      onClick={onOpen}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
      tabIndex={0}
    >
      <Table.Td style={{ whiteSpace: "nowrap" }}>{formatDate(e.date)}</Table.Td>
      <Table.Td maw={260}>
        <Text size="sm" fw={600} truncate>
          {e.merchant ?? e.fileName}
        </Text>
        {e.description && (
          <Text size="xs" c="dimmed" truncate>
            {e.description}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600}>
          {formatAmount(e.totalAmount, e.currency)}
        </Text>
        {e.currency !== "CHF" && e.booking.amountChf !== null && (
          <Text size="xs" c="dimmed">
            {formatChfPrecise(e.booking.amountChf)}
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {formatCard(e.cardLast4)}
        </Text>
      </Table.Td>
      <Table.Td>
        <AccountBadge
          accountId={e.paymentAccountId}
          name={e.paymentAccountName}
          accounts={accounts}
        />
      </Table.Td>
      <Table.Td maw={200}>
        {e.categoryLabel ? (
          <Text size="sm" truncate>
            {e.categoryLabel}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {debitAccountNo ?? "····"} / {creditAccountNo ?? "····"}
        </Text>
      </Table.Td>
      <Table.Td>
        <ExpenseStatusBadge status={e.status} />
      </Table.Td>
      <Table.Td ta="center">
        {isRevolut &&
          (e.transactionId ? (
            <Tooltip label={t("expenses.matched")}>
              <ThemeIcon size="sm" radius="xl" variant="light" color="teal">
                <IconLink size={12} />
              </ThemeIcon>
            </Tooltip>
          ) : (
            <Tooltip label={t("expenses.notMatched")}>
              <ThemeIcon size="sm" radius="xl" variant="light" color="orange">
                <IconLinkOff size={12} />
              </ThemeIcon>
            </Tooltip>
          ))}
        {e.bexioEntryId && (
          <Tooltip label={t("expenses.bexioEntry", { id: e.bexioEntryId })}>
            <Badge size="xs" variant="dot" color="teal" ml={4}>
              bexio
            </Badge>
          </Tooltip>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
