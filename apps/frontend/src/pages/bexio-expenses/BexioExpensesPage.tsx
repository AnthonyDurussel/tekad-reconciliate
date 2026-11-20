import { useMemo, useState, type MouseEvent } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
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
  IconExternalLink,
  IconFileInvoice,
  IconLinkOff,
  IconPaperclip,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  PermissionDTO,
  SyncSourceDTO,
  type BexioExpenseDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import { StatTile, type TileIcon } from "@/components/dashboard/StatTile";
import usePermissions from "@/hooks/usePermissions";
import useCreateExpense from "@/hooks/useCreateExpense";
import {
  useGetBexioExpensesQuery,
  useGetSyncStatusQuery,
  useRunSyncMutation,
} from "@/store/slices/api";
import { getErrorMessage, isConflict } from "@/utils/apiError";
import {
  formatAmount,
  formatChfPrecise,
  formatDate,
  formatDateTime,
} from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";
import {
  STATE_COLOR,
  reconciliationState,
  summarize,
  type SummaryLine,
} from "./bexioExpenses";

const TILES: {
  key: "all" | "linked" | "unlinked";
  icon: TileIcon;
  accent: string;
}[] = [
  { key: "all", icon: IconFileInvoice, accent: "var(--mantine-color-gray-6)" },
  {
    key: "linked",
    icon: IconCircleCheck,
    accent: "var(--mantine-color-teal-6)",
  },
  {
    key: "unlinked",
    icon: IconLinkOff,
    accent: "var(--mantine-color-orange-6)",
  },
];

/**
 * Les dépenses de bexio (« Ausgaben »), lues en direct : chacune devrait
 * avoir sa dépense dans l'application — « Créer la dépense » la crée (ou
 * reprend celle dont la pièce est jointe dans bexio). Filtres dans l'URL.
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
  const unlinkedOnly = params.get("unlinked") === "1";
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const pushSearch = useDebouncedCallback(
    (value: string) => setParam({ search: value.trim() || null }),
    300,
  );

  // Toute la liste : les tuiles comptent aussi les rattachées.
  const {
    data: all = [],
    isFetching,
    error,
  } = useGetBexioExpensesQuery({
    ...period,
    search: searchParam || undefined,
  });
  const { data: status } = useGetSyncStatusQuery();
  const [runSync, { isLoading: syncing }] = useRunSyncMutation();
  const create = useCreateExpense();

  const rows = useMemo(
    () => (unlinkedOnly ? all.filter((e) => e.expenseId === null) : all),
    [all, unlinkedOnly],
  );
  const summary = useMemo(() => summarize(all), [all]);
  const lastRun = status?.last[SyncSourceDTO.BEXIO_EXPENSES];
  const notConfigured =
    (status ? !status.bexioConfigured : false) || isConflict(error);

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
        icon={<IconFileInvoice size={22} stroke={1.7} />}
        title={t("bexioExpenses.title")}
        subtitle={t("bexioExpenses.subtitle")}
        count={rows.length}
        badge={
          lastRun && (
            <Badge
              variant="light"
              color={lastRun.success === false ? "red" : "teal"}
            >
              {t("bexioExpenses.lastSync", {
                date: formatDateTime(lastRun.startedAt),
              })}
            </Badge>
          )
        }
        actions={
          canSync && (
            <Tooltip label={t("bexioExpenses.syncHint")} multiline w={280}>
              <Button
                variant="white"
                leftSection={<IconRefresh size={16} />}
                loading={syncing}
                disabled={notConfigured}
                onClick={sync}
              >
                {t("bexioExpenses.sync")}
              </Button>
            </Tooltip>
          )
        }
      />
      {notConfigured && (
        <Alert color="gray" variant="light" mb="md">
          {t("bexioExpenses.notConfigured")}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, xs: 3 }} mb="md">
        {TILES.map(({ key, icon, accent }) => {
          const active =
            key === "unlinked" ? unlinkedOnly : key === "all" && !unlinkedOnly;
          return (
            <UnstyledButton
              key={key}
              disabled={key === "linked"}
              onClick={() =>
                setParam({ unlinked: key === "unlinked" ? "1" : null })
              }
              aria-pressed={active}
            >
              <SummaryTile
                label={t(`bexioExpenses.tiles.${key}`)}
                line={summary[key]}
                icon={icon}
                accent={accent}
                loading={isFetching && all.length === 0}
                active={active}
              />
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
      <Group gap="sm" mb="md" align="flex-end" wrap="wrap">
        <PeriodPicker
          value={period}
          onChange={(p) => setParam({ from: p.from, to: p.to })}
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
        <Switch
          label={t("bexioExpenses.unlinkedOnly")}
          checked={unlinkedOnly}
          onChange={(e) =>
            setParam({ unlinked: e.currentTarget.checked ? "1" : null })
          }
          mb={8}
        />
      </Group>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1250}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("bexioExpenses.paidOn")}</Table.Th>
                <Table.Th>{t("bexioExpenses.documentNo")}</Table.Th>
                <Table.Th>{t("bexioExpenses.vendor")}</Table.Th>
                <Table.Th>{t("bexioExpenses.bookingAccount")}</Table.Th>
                <Table.Th>{t("bexioExpenses.paymentAccount")}</Table.Th>
                <Table.Th ta="right">{t("expenses.amount")}</Table.Th>
                <Table.Th>{t("bexioExpenses.attachments")}</Table.Th>
                <Table.Th>{t("bexioExpenses.reconciliation")}</Table.Th>
                <Table.Th>{t("bexioExpenses.expense")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <BexioExpenseRow
                  key={row.id}
                  row={row}
                  canManage={canManage}
                  backState={backState}
                  creating={create.pendingBexioId === row.id}
                  onOpen={() =>
                    navigate(`/bexio-expenses/${row.id}`, { state: backState })
                  }
                  onCreate={() => create.fromBexio(row.id)}
                />
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text c="dimmed" ta="center" py="lg">
                      {isFetching
                        ? t("common.loading")
                        : notConfigured
                          ? t("bexioExpenses.notConfiguredShort")
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
  creating,
  onOpen,
  onCreate,
}: {
  row: BexioExpenseDTO;
  canManage: boolean;
  backState: { back: string };
  creating: boolean;
  onOpen: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const state = reconciliationState(row);
  return (
    <Table.Tr onClick={onOpen} style={{ cursor: "pointer" }}>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        {formatDate(row.paidOn)}
      </Table.Td>
      <Table.Td style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" ff="monospace">
          {row.documentNo}
        </Text>
        {row.status === "DRAFT" && (
          <Badge size="xs" variant="outline" color="gray">
            {t("bexioExpenses.draft")}
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={260}>
        <Anchor
          component={Link}
          to={`/bexio-expenses/${row.id}`}
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
      <Table.Td maw={220}>
        <Stack gap={2} align="flex-start">
          <Text size="sm" truncate>
            {row.paymentAccountName ?? row.bankAccountName ?? "—"}
          </Text>
          {row.bankAccountNo && (
            <Text size="xs" c="dimmed" ff="monospace">
              {row.bankAccountNo}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>
        <Text size="sm" fw={600}>
          {formatAmount(row.gross, row.currency)}
        </Text>
      </Table.Td>
      <Table.Td>
        {row.attachmentIds.length > 0 ? (
          <Group gap={4} wrap="nowrap">
            <IconPaperclip size={14} />
            <Text size="sm">{row.attachmentIds.length}</Text>
          </Group>
        ) : (
          <Badge size="sm" variant="light" color="red">
            {t("bexioExpenses.noAttachmentShort")}
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" color={STATE_COLOR[state]}>
          {t(`bexioExpenses.reconciliationState.${state}`)}
        </Badge>
      </Table.Td>
      <Table.Td onClick={stop} style={{ whiteSpace: "nowrap" }}>
        {row.expenseId ? (
          <Anchor component={Link} to={`/expenses/${row.expenseId}`} size="sm">
            <Group gap={4} wrap="nowrap">
              {t("bexioExpenses.openExpense")}
              <IconExternalLink size={14} />
            </Group>
          </Anchor>
        ) : canManage ? (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            loading={creating}
            onClick={onCreate}
          >
            {t("bexioExpenses.create")}
          </Button>
        ) : (
          <Badge size="sm" variant="light" color="orange">
            {t("bexioExpenses.unlinked")}
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
