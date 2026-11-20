import { useMemo, useState, type MouseEvent } from "react";
import {
  Anchor,
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
  Tooltip,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconFileInvoice,
  IconFileSpreadsheet,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ExpenseStatusDTO,
  PermissionDTO,
  SyncSourceDTO,
  type BexioExpenseDTO,
  type ExpenseDTO,
  type ExpenseQueryDTO,
  type PaymentAccountDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import AccountBadge from "@/components/expense/AccountBadge";
import ExpenseLinkIcons from "@/components/expense/ExpenseLinkIcons";
import ExpenseOriginBadge from "@/components/expense/ExpenseOriginBadge";
import ExpenseStatusBadge from "@/components/expense/ExpenseStatusBadge";
import usePermissions from "@/hooks/usePermissions";
import useCreateExpense from "@/hooks/useCreateExpense";
import {
  expensesExportUrl,
  useGetBexioExpensesQuery,
  useGetExpenseCategoriesQuery,
  useGetExpensesQuery,
  useGetPaymentAccountsQuery,
  useGetSyncStatusQuery,
  useRunSyncMutation,
} from "@/store/slices/api";
import { getErrorMessage, isConflict } from "@/utils/apiError";
import { enumOptions } from "@/utils/enumOptions";
import {
  formatAmount,
  formatCard,
  formatChfPrecise,
  formatDate,
  formatDateTime,
} from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";
import { reconciliationState } from "@/pages/bexio-expenses/bexioExpenses";
import { expenseLabel } from "./expenseLinks";
import {
  LIST_ISSUE_FILTERS,
  NONE,
  NOT_IN_APP,
  apiIssueFilter,
  bexioLinkStates,
  bexioOnlyRows,
  listTotals,
  mergeRows,
  parseListIssueFilter,
} from "./mergeRows";

/**
 * Les dépenses : chacune née d'une pièce de l'inbox bexio, d'une sortie du
 * relevé ou d'une dépense bexio, avec ses trois liens (pièce, bexio,
 * rapprochement) — et, en lignes propres, les dépenses bexio de la période
 * (lues en direct) qui n'ont pas encore leur dépense ici (« Créer la
 * dépense »). Filtres dans l'URL (période, compte de paiement, type, statut,
 * « À faire », recherche) : le retour depuis le détail les retrouve ;
 * l'export Excel les reprend (dépenses de l'application seulement).
 */
export default function ExpensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canManage = can(PermissionDTO.EXPENSE_MANAGE);
  const canSync = can(PermissionDTO.SYNC_RUN);
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
  const issue = parseListIssueFilter(params.get("issue"));
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
    issue: apiIssueFilter(issue),
    search: searchParam || undefined,
  };
  const { data: expenses = [], isFetching } = useGetExpensesQuery(query);
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const { data: categories = [] } = useGetExpenseCategoriesQuery();
  const { data: syncStatus } = useGetSyncStatusQuery();
  // Les dépenses bexio de la période, lues en direct (409 sans bexio : rien).
  const {
    data: bexioExpenses = [],
    isFetching: bexioFetching,
    error: bexioError,
  } = useGetBexioExpensesQuery(
    { ...period, search: searchParam || undefined },
    { skip: syncStatus ? !syncStatus.bexioConfigured : false },
  );
  const bexioNotConfigured =
    (syncStatus ? !syncStatus.bexioConfigured : false) ||
    isConflict(bexioError);
  const [runSync, { isLoading: syncing }] = useRunSyncMutation();
  const create = useCreateExpense();
  const lastRun = syncStatus?.last[SyncSourceDTO.BEXIO_EXPENSES];

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

  const filters = useMemo(
    () => ({ paymentAccountId: accountId, categoryId, status, issue }),
    [accountId, categoryId, status, issue],
  );
  const rows = useMemo(
    () => mergeRows(expenses, bexioExpenses, filters, categories),
    [expenses, bexioExpenses, filters, categories],
  );
  const totals = useMemo(() => listTotals(rows), [rows]);
  /** Les dépenses bexio hors application (compte et type filtrés, pas le statut). */
  const notInApp = useMemo(() => {
    const only = bexioOnlyRows(
      bexioExpenses,
      { ...filters, status: null, issue: null },
      categories,
    );
    return {
      count: only.length,
      chf: only
        .filter((b) => b.currency === "CHF")
        .reduce((sum, b) => sum + b.gross, 0),
    };
  }, [bexioExpenses, filters, categories]);
  const loading = isFetching || (bexioFetching && issue === NOT_IN_APP);

  const state = { back: location.search };
  const open = (id: string) => navigate(`/expenses/${id}`, { state });
  const openBexio = (id: string) =>
    navigate(`/bexio-expenses/${id}`, { state });

  const sync = async () => {
    try {
      const run = await runSync({ target: "bexio-expenses" }).unwrap();
      notifications.show({
        color: run.success === false ? "red" : "teal",
        title: t(`enum.syncSource.${run.source}`),
        message:
          run.success === false
            ? (run.message ?? t("sync.failed"))
            : t("sync.count", { count: run.count }),
      });
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  return (
    <Page maxWidth={1500}>
      <PageHeader
        icon={<IconReceipt size={22} stroke={1.7} />}
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        count={rows.length}
        badge={
          lastRun && (
            <Badge
              variant="light"
              color={lastRun.success === false ? "red" : "teal"}
            >
              {t("expenses.bexio.lastSync", {
                date: formatDateTime(lastRun.startedAt),
              })}
            </Badge>
          )
        }
        actions={
          <>
            {canSync && (
              <Tooltip label={t("expenses.bexio.syncHint")} multiline w={280}>
                <Button
                  variant="white"
                  leftSection={<IconRefresh size={16} />}
                  loading={syncing}
                  disabled={bexioNotConfigured}
                  onClick={sync}
                >
                  {t("expenses.bexio.sync")}
                </Button>
              </Tooltip>
            )}
            <Tooltip label={t("expenses.exportHint")} multiline w={260}>
              <Button
                component="a"
                href={expensesExportUrl(query)}
                variant="default"
                leftSection={<IconFileSpreadsheet size={16} />}
              >
                {t("expenses.export")}
              </Button>
            </Tooltip>
          </>
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
          <Select
            placeholder={t("expenses.allIssues")}
            aria-label={t("expenses.issueFilter")}
            data={LIST_ISSUE_FILTERS.map((value) => ({
              value,
              label: t(`expenses.issueOptions.${value}`),
            }))}
            value={issue}
            onChange={(v) => setParam({ issue: v })}
            clearable
            w={260}
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
        <BexioSummary
          notConfigured={bexioNotConfigured}
          error={bexioNotConfigured ? undefined : bexioError}
          count={notInApp.count}
          chf={notInApp.chf}
          active={issue === NOT_IN_APP}
          onShow={() => setParam({ issue: NOT_IN_APP, status: null })}
        />
      </Stack>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1200}>
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
                <Table.Th>{t("expenses.linksTitle")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) =>
                row.kind === "expense" ? (
                  <ExpenseRow
                    key={row.key}
                    expense={row.expense}
                    bexioDocumentNo={row.bexioDocumentNo}
                    accounts={accounts}
                    onOpen={() => open(row.expense.id)}
                  />
                ) : (
                  <BexioOnlyRow
                    key={row.key}
                    row={row.bexio}
                    accounts={accounts}
                    canManage={canManage}
                    creating={create.pendingBexioId === row.bexio.id}
                    onOpen={() => openBexio(row.bexio.id)}
                    onCreate={() => create.fromBexio(row.bexio.id)}
                  />
                ),
              )}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text c="dimmed" ta="center" py="lg">
                      {loading
                        ? t("common.loading")
                        : issue === NOT_IN_APP
                          ? t("expenses.bexio.empty")
                          : t("expenses.empty")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            {rows.length > 0 && (
              <Table.Tfoot>
                {totals.app.count > 0 && (
                  <Table.Tr>
                    <Table.Th colSpan={2}>
                      {t("expenses.total", { count: totals.app.count })}
                    </Table.Th>
                    <Table.Th ta="right">
                      {formatChfPrecise(totals.app.chf)}
                    </Table.Th>
                    <Table.Th colSpan={6}>
                      {totals.app.unpriced > 0 && (
                        <Text size="xs" c="dimmed" fw={400}>
                          {t("expenses.unpriced", {
                            count: totals.app.unpriced,
                          })}
                        </Text>
                      )}
                    </Table.Th>
                  </Table.Tr>
                )}
                {totals.bexio.count > 0 && (
                  <Table.Tr>
                    <Table.Th colSpan={2}>
                      {t("expenses.bexio.total", {
                        count: totals.bexio.count,
                      })}
                    </Table.Th>
                    <Table.Th ta="right">
                      {formatChfPrecise(totals.bexio.chf)}
                    </Table.Th>
                    <Table.Th colSpan={6}>
                      {totals.bexio.otherCurrency > 0 && (
                        <Text size="xs" c="dimmed" fw={400}>
                          {t("expenses.bexio.otherCurrency", {
                            count: totals.bexio.otherCurrency,
                          })}
                        </Text>
                      )}
                    </Table.Th>
                  </Table.Tr>
                )}
              </Table.Tfoot>
            )}
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Page>
  );
}

/**
 * Sous les filtres : combien de dépenses bexio de la période n'ont pas leur
 * dépense ici (lien vers « Pas dans l'application ») ; bexio non configuré
 * ou injoignable : une simple mention, la liste reste celle de l'application.
 */
function BexioSummary({
  notConfigured,
  error,
  count,
  chf,
  active,
  onShow,
}: {
  notConfigured: boolean;
  error: unknown;
  count: number;
  chf: number;
  active: boolean;
  onShow: () => void;
}) {
  const { t } = useTranslation();
  if (notConfigured || error) {
    return (
      <Text size="xs" c="dimmed">
        {notConfigured
          ? t("expenses.bexio.notConfigured")
          : t("expenses.bexio.unavailable", {
              message: getErrorMessage(error),
            })}
      </Text>
    );
  }
  if (count === 0 || active) return null;
  return (
    <Group gap="xs">
      <IconFileInvoice size={16} color="var(--mantine-color-orange-6)" />
      <Text size="sm">
        {t("expenses.bexio.notInAppCount", {
          count,
          amount: formatChfPrecise(chf),
        })}
      </Text>
      <Anchor component="button" type="button" size="sm" onClick={onShow}>
        {t("expenses.bexio.showNotInApp")}
      </Anchor>
    </Group>
  );
}

/** Un clic dans une cellule d'actions n'ouvre pas le détail. */
const stop = (e: MouseEvent) => e.stopPropagation();

/**
 * Une dépense bexio sans dépense dans l'application : un clic ouvre son
 * détail bexio ; « Créer la dépense » la crée ici.
 */
function BexioOnlyRow({
  row,
  accounts,
  canManage,
  creating,
  onOpen,
  onCreate,
}: {
  row: BexioExpenseDTO;
  accounts: PaymentAccountDTO[];
  canManage: boolean;
  creating: boolean;
  onOpen: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const label = row.vendor ?? row.title;
  const states = bexioLinkStates(row);
  return (
    <Table.Tr
      style={{ cursor: "pointer" }}
      onClick={onOpen}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
      tabIndex={0}
    >
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        {formatDate(row.paidOn)}
      </Table.Td>
      <Table.Td maw={280}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600} truncate c={label ? undefined : "dimmed"}>
            {label ?? t("expenses.noMerchant")}
          </Text>
          <Tooltip label={t("expenses.bexio.sourceHint")} multiline w={240}>
            <Badge
              size="xs"
              variant="light"
              color="cyan"
              style={{ flexShrink: 0 }}
            >
              {t("expenses.bexio.source")}
            </Badge>
          </Tooltip>
          {row.status === "DRAFT" && (
            <Badge
              size="xs"
              variant="outline"
              color="gray"
              style={{ flexShrink: 0 }}
            >
              {t("bexioExpenses.draft")}
            </Badge>
          )}
        </Group>
        {row.vendor && row.title && (
          <Text size="xs" c="dimmed" truncate>
            {row.title}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600}>
          {formatAmount(row.gross, row.currency)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          —
        </Text>
      </Table.Td>
      <Table.Td>
        <AccountBadge
          accountId={row.paymentAccountId}
          name={row.paymentAccountName}
          accounts={accounts}
        />
      </Table.Td>
      <Table.Td maw={200}>
        {row.bookingAccountNo ? (
          <Text size="sm" truncate>
            <Text span ff="monospace" size="sm">
              {row.bookingAccountNo}
            </Text>{" "}
            {row.bookingAccountName}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {row.bookingAccountNo ?? "····"} / {row.bankAccountNo ?? "····"}
        </Text>
      </Table.Td>
      <Table.Td onClick={stop} style={{ whiteSpace: "nowrap" }} miw={140}>
        <Stack gap={4} align="flex-start">
          <Badge size="sm" variant="light" color="orange">
            {t("expenses.bexio.notInApp")}
          </Badge>
          {canManage && (
            <Button
              size="compact-xs"
              leftSection={<IconPlus size={12} />}
              loading={creating}
              onClick={onCreate}
            >
              {t("bexioExpenses.create")}
            </Button>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <ExpenseLinkIcons
          states={states}
          labels={{
            receipt:
              states.receipt === "ok"
                ? t("bexioExpenses.attached", {
                    count: row.attachmentIds.length,
                  })
                : t("bexioExpenses.noAttachment"),
            reconciliation: t(
              `bexioExpenses.reconciliationState.${reconciliationState(row)}`,
            ),
          }}
        />
        <Text size="xs" c="dimmed" ff="monospace" mt={2}>
          {row.documentNo}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

function ExpenseRow({
  expense: e,
  bexioDocumentNo,
  accounts,
  onOpen,
}: {
  expense: ExpenseDTO;
  bexioDocumentNo: string | null;
  accounts: PaymentAccountDTO[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { debitAccountNo, creditAccountNo } = e.booking;
  const label = expenseLabel(e);
  return (
    <Table.Tr
      style={{ cursor: "pointer" }}
      onClick={onOpen}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
      tabIndex={0}
    >
      <Table.Td style={{ whiteSpace: "nowrap" }}>{formatDate(e.date)}</Table.Td>
      <Table.Td maw={280}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600} truncate c={label ? undefined : "dimmed"}>
            {label ?? t("expenses.noMerchant")}
          </Text>
          <ExpenseOriginBadge source={e.source} />
        </Group>
        {e.description && e.description !== label && (
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
      <Table.Td>
        <ExpenseLinkIcons expense={e} />
        {bexioDocumentNo && (
          <Text size="xs" c="dimmed" ff="monospace" mt={2}>
            {bexioDocumentNo}
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
