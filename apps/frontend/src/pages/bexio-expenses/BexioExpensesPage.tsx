import { useMemo, useState, type MouseEvent } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCircleCheck,
  IconFileInvoice,
  IconLink,
  IconLinkOff,
  IconPaperclip,
  IconReceiptOff,
  IconRefresh,
  IconSearch,
  IconTransfer,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BexioExpenseIssueDTO,
  PermissionDTO,
  ReconciliationModeDTO,
  SyncSourceDTO,
  type BexioExpenseDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import { StatTile, type TileIcon } from "@/components/dashboard/StatTile";
import usePermissions from "@/hooks/usePermissions";
import {
  useGetBexioExpensesQuery,
  useGetPaymentAccountsQuery,
  useGetSyncStatusQuery,
  useRunSyncMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import {
  formatAmount,
  formatChfPrecise,
  formatDate,
  formatDateTime,
} from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";
import {
  ISSUE_FILTERS,
  filterByIssue,
  parseIssueFilter,
  summarize,
  type IssueFilter,
  type SummaryLine,
} from "./bexioExpenses";
import LinkReceiptModal from "./LinkReceiptModal";
import useConfirmUnlink from "./useConfirmUnlink";

/** Valeur du filtre « compte » pour « compte inconnu ». */
const NONE = "none";

const RECONCILIATION_COLOR: Record<ReconciliationModeDTO, string> = {
  [ReconciliationModeDTO.BEXIO]: "blue",
  [ReconciliationModeDTO.STATEMENT_IMPORT]: "grape",
  [ReconciliationModeDTO.NONE]: "gray",
};

const TILES: {
  filter: IssueFilter;
  key: "all" | "missingReceipt" | "notReconciled" | "ok";
  icon: TileIcon;
  accent: string;
}[] = [
  {
    filter: "all",
    key: "all",
    icon: IconFileInvoice,
    accent: "var(--mantine-color-gray-6)",
  },
  {
    filter: BexioExpenseIssueDTO.MISSING_RECEIPT,
    key: "missingReceipt",
    icon: IconReceiptOff,
    accent: "var(--mantine-color-red-6)",
  },
  {
    filter: BexioExpenseIssueDTO.NOT_RECONCILED,
    key: "notReconciled",
    icon: IconTransfer,
    accent: "var(--mantine-color-orange-6)",
  },
  {
    filter: "ok",
    key: "ok",
    icon: IconCircleCheck,
    accent: "var(--mantine-color-teal-6)",
  },
];

/**
 * Les dépenses de bexio (« Ausgaben ») : chacune doit avoir sa pièce et, si
 * son compte payeur l'exige, être rapprochée — dans bexio, ou ici par la
 * transaction du relevé importé. Filtres dans l'URL ; « Lier une pièce »
 * joint le fichier d'une pièce à la dépense dans bexio.
 */
export default function BexioExpensesPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can(PermissionDTO.EXPENSE_MANAGE);
  const canSync = can(PermissionDTO.SYNC_RUN);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  /** Retour du détail vers la liste avec les mêmes filtres. */
  const backState = { back: params.toString() ? `?${params}` : "" };
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
  const issue = parseIssueFilter(params.get("issue"));
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const pushSearch = useDebouncedCallback(
    (value: string) => setParam({ search: value.trim() || null }),
    300,
  );

  // Le filtre « problème » se fait ici : les tuiles comptent toute la liste.
  const {
    data: all = [],
    isFetching,
    error,
  } = useGetBexioExpensesQuery({
    ...period,
    paymentAccountId: accountId ?? undefined,
    search: searchParam || undefined,
  });
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const { data: status } = useGetSyncStatusQuery();
  const [runSync, { isLoading: syncing }] = useRunSyncMutation();
  const [linking, setLinking] = useState<BexioExpenseDTO | null>(null);

  const rows = useMemo(() => filterByIssue(all, issue), [all, issue]);
  const summary = useMemo(() => summarize(all), [all]);
  const lastRun = status?.last[SyncSourceDTO.BEXIO_EXPENSES];
  const bexioConfigured = status?.bexioConfigured ?? true;
  const neverSynced = !!status && !lastRun;

  const accountOptions = [
    ...accounts
      .filter((a) => a.active || a.id === accountId)
      .map((a) => ({ value: a.id, label: a.name })),
    { value: NONE, label: t("bexioExpenses.unknownAccount") },
  ];

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

  const confirmUnlink = useConfirmUnlink();

  const syncButton = canSync && (
    <Tooltip
      label={t("bexioExpenses.notConfigured")}
      disabled={bexioConfigured}
    >
      <Button
        variant="white"
        leftSection={<IconRefresh size={16} />}
        loading={syncing}
        disabled={!bexioConfigured}
        onClick={sync}
      >
        {t("bexioExpenses.sync")}
      </Button>
    </Tooltip>
  );

  return (
    <Page maxWidth={1500}>
      <PageHeader
        icon={<IconFileInvoice size={22} stroke={1.7} />}
        title={t("bexioExpenses.title")}
        subtitle={t("bexioExpenses.subtitle")}
        count={rows.length}
        badge={
          status && (
            <Badge
              variant="light"
              color={
                lastRun?.success === false ? "red" : lastRun ? "teal" : "gray"
              }
            >
              {lastRun
                ? t("bexioExpenses.lastSync", {
                    date: formatDateTime(lastRun.startedAt),
                  })
                : t("bexioExpenses.neverSynced")}
            </Badge>
          )
        }
        actions={syncButton}
      />
      {status && !status.bexioConfigured && (
        <Alert color="gray" variant="light" mb="md">
          {t("bexioExpenses.notConfigured")}
        </Alert>
      )}
      {neverSynced && status.bexioConfigured && (
        <Alert
          color="blue"
          variant="light"
          mb="md"
          icon={<IconRefresh size={18} />}
          title={t("bexioExpenses.emptyTitle")}
        >
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">{t("bexioExpenses.emptyText")}</Text>
            {canSync && (
              <Button size="xs" loading={syncing} onClick={sync}>
                {t("bexioExpenses.sync")}
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mb="md">
        {TILES.map(({ filter, key, icon, accent }) => (
          <UnstyledButton
            key={key}
            onClick={() =>
              setParam({ issue: filter === "all" ? null : filter })
            }
            aria-pressed={issue === filter}
          >
            <SummaryTile
              label={t(`bexioExpenses.tiles.${key}`)}
              line={summary[key]}
              icon={icon}
              accent={accent}
              loading={isFetching && all.length === 0}
              active={issue === filter}
            />
          </UnstyledButton>
        ))}
      </SimpleGrid>
      <Stack gap="sm" mb="md">
        <SegmentedControl
          data={ISSUE_FILTERS.map((value) => ({
            value,
            label: t(`bexioExpenses.filter.${value}`),
          }))}
          value={issue}
          onChange={(v) => setParam({ issue: v === "all" ? null : v })}
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
            aria-label={t("bexioExpenses.paymentAccount")}
            data={accountOptions}
            value={accountId}
            onChange={(v) => setParam({ account: v })}
            clearable
            w={230}
          />
          <TextInput
            placeholder={t("bexioExpenses.search")}
            aria-label={t("bexioExpenses.search")}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              pushSearch(e.currentTarget.value);
            }}
            w={260}
          />
        </Group>
      </Stack>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1300}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("bexioExpenses.paidOn")}</Table.Th>
                <Table.Th>{t("bexioExpenses.documentNo")}</Table.Th>
                <Table.Th>{t("bexioExpenses.vendor")}</Table.Th>
                <Table.Th>{t("bexioExpenses.bookingAccount")}</Table.Th>
                <Table.Th>{t("bexioExpenses.paymentAccount")}</Table.Th>
                <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
                <Table.Th>{t("bexioExpenses.receipt")}</Table.Th>
                <Table.Th>{t("bexioExpenses.reconciliation")}</Table.Th>
                <Table.Th>{t("bexioExpenses.issues")}</Table.Th>
                {canManage && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <BexioExpenseRow
                  key={row.id}
                  row={row}
                  canManage={canManage}
                  backState={backState}
                  onOpen={() =>
                    navigate(`/bexio-expenses/${row.id}`, { state: backState })
                  }
                  onLink={() => setLinking(row)}
                  onUnlink={() => confirmUnlink(row)}
                />
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={canManage ? 10 : 9}>
                    <Text c="dimmed" ta="center" py="lg">
                      {isFetching
                        ? t("common.loading")
                        : error
                          ? getErrorMessage(error)
                          : t("bexioExpenses.empty")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <LinkReceiptModal
        bexioExpense={linking}
        period={period}
        onClose={() => setLinking(null)}
      />
    </Page>
  );
}

function SummaryTile({
  label,
  line,
  icon,
  accent,
  loading,
  active,
}: {
  label: string;
  line: SummaryLine;
  icon: TileIcon;
  accent: string;
  loading: boolean;
  active: boolean;
}) {
  return (
    <div
      style={{
        height: "100%",
        borderRadius: "var(--mantine-radius-lg)",
        outline: active ? `2px solid ${accent}` : undefined,
      }}
    >
      <StatTile
        label={label}
        icon={icon}
        accent={accent}
        loading={loading}
        value={line.count}
        footer={
          <Text size="xs" c="dimmed">
            {formatChfPrecise(line.amountChf)}
          </Text>
        }
      />
    </div>
  );
}

/** Un clic dans une cellule d'actions n'ouvre pas le détail. */
const stop = (e: MouseEvent) => e.stopPropagation();

function BexioExpenseRow({
  row,
  canManage,
  backState,
  onOpen,
  onLink,
  onUnlink,
}: {
  row: BexioExpenseDTO;
  canManage: boolean;
  backState: { back: string };
  onOpen: () => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const { t } = useTranslation();
  const draft = row.status === "DRAFT";
  const detailPath = `/bexio-expenses/${row.id}`;
  return (
    <Table.Tr onClick={onOpen} style={{ cursor: "pointer" }}>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        {formatDate(row.paidOn)}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {row.documentNo}
        </Text>
        {draft && (
          <Badge size="xs" variant="outline" color="gray">
            {t("bexioExpenses.draft")}
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={260}>
        <Anchor
          component={Link}
          to={detailPath}
          state={backState}
          onClick={stop}
          size="sm"
          fw={600}
          c="inherit"
          style={{ display: "block" }}
          truncate
        >
          {row.vendor ?? row.title ?? "—"}
        </Anchor>
        {row.vendor && row.title && (
          <Text size="xs" c="dimmed" truncate>
            {row.title}
          </Text>
        )}
      </Table.Td>
      <Table.Td maw={220}>
        {row.bookingAccountNo ? (
          <>
            <Text size="sm" ff="monospace">
              {row.bookingAccountNo}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {row.bookingAccountName}
            </Text>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {row.paymentAccountId ? (
          <Stack gap={2} align="flex-start">
            <Text size="sm">{row.paymentAccountName}</Text>
            {row.reconciliation && (
              <Badge
                size="xs"
                variant="light"
                color={RECONCILIATION_COLOR[row.reconciliation]}
              >
                {t(`bexioExpenses.reconciliationMode.${row.reconciliation}`)}
              </Badge>
            )}
          </Stack>
        ) : (
          <Tooltip label={t("bexioExpenses.toAssociateHint")}>
            <Badge
              component={Link}
              to={detailPath}
              state={backState}
              onClick={stop}
              size="sm"
              variant="light"
              color="orange"
              style={{ cursor: "pointer" }}
            >
              {t("bexioExpenses.toAssociate")}
            </Badge>
          </Tooltip>
        )}
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600}>
          {formatAmount(row.gross, row.currency)}
        </Text>
      </Table.Td>
      <Table.Td maw={220} onClick={stop}>
        <ReceiptCell row={row} canManage={canManage} onLink={onLink} />
      </Table.Td>
      <Table.Td onClick={stop}>
        <ReconciliationCell row={row} />
      </Table.Td>
      <Table.Td>
        {row.issues.length === 0 ? (
          <Badge size="sm" variant="light" color="teal">
            {t("bexioExpenses.ok")}
          </Badge>
        ) : (
          <Stack gap={4} align="flex-start">
            {row.issues.map((code) => (
              <Badge
                key={code}
                size="xs"
                variant="light"
                color={code === BexioExpenseIssueDTO.DRAFT ? "gray" : "red"}
              >
                {t(`bexioExpenses.issue.${code}`)}
              </Badge>
            ))}
          </Stack>
        )}
      </Table.Td>
      {canManage && (
        <Table.Td onClick={stop}>
          {row.expenseId ? (
            <Tooltip label={t("bexioExpenses.unlink.action")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={onUnlink}
                aria-label={t("bexioExpenses.unlink.action")}
              >
                <IconLinkOff size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label={t("bexioExpenses.link.action")}>
              <ActionIcon
                variant="subtle"
                onClick={onLink}
                aria-label={t("bexioExpenses.link.action")}
              >
                <IconLink size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Table.Td>
      )}
    </Table.Tr>
  );
}

function ReceiptCell({
  row,
  canManage,
  onLink,
}: {
  row: BexioExpenseDTO;
  canManage: boolean;
  onLink: () => void;
}) {
  const { t } = useTranslation();
  if (row.expenseId) {
    return (
      <Anchor
        component={Link}
        to={`/expenses/${row.expenseId}`}
        size="sm"
        style={{ display: "block" }}
        truncate
      >
        {row.expenseFileName ?? t("bexioExpenses.openReceipt")}
      </Anchor>
    );
  }
  if (row.attachmentCount > 0) {
    return (
      <Group gap={4} wrap="nowrap">
        <IconPaperclip size={14} />
        <Text size="sm" c="dimmed">
          {t("bexioExpenses.attached", { count: row.attachmentCount })}
        </Text>
      </Group>
    );
  }
  return (
    <Group gap={6} wrap="nowrap">
      <Badge size="sm" variant="light" color="red">
        {t("bexioExpenses.missing")}
      </Badge>
      {canManage && (
        <Anchor component="button" size="xs" onClick={onLink}>
          {t("bexioExpenses.link.action")}
        </Anchor>
      )}
    </Group>
  );
}

function ReconciliationCell({ row }: { row: BexioExpenseDTO }) {
  const { t } = useTranslation();
  if (row.reconciled === null) {
    return (
      <Badge size="sm" variant="light" color="gray">
        {t("bexioExpenses.notRequired")}
      </Badge>
    );
  }
  if (row.reconciled) {
    return (
      <Stack gap={0} align="flex-start">
        <Badge size="sm" variant="light" color="teal">
          {t("bexioExpenses.reconciled")}
        </Badge>
        <Text size="xs" c="dimmed">
          {row.bexioReconciled
            ? t("bexioExpenses.reconciledInBexio")
            : t("bexioExpenses.reconciledStatement")}
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={2} align="flex-start">
      <Badge size="sm" variant="light" color="orange">
        {t("bexioExpenses.toReconcile")}
      </Badge>
      {row.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT ? (
        row.expenseId ? (
          <Anchor component={Link} to={`/expenses/${row.expenseId}`} size="xs">
            {t("bexioExpenses.reconcile")}
          </Anchor>
        ) : (
          <Text size="xs" c="dimmed">
            {t("bexioExpenses.linkFirst")}
          </Text>
        )
      ) : (
        <Text size="xs" c="dimmed">
          {t("bexioExpenses.reconcileInBexio")}
        </Text>
      )}
    </Stack>
  );
}
