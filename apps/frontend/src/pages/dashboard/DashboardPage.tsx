import { useMemo } from "react";
import { Grid, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconBuildingBank,
  IconCategory,
  IconChecklist,
  IconCircleCheck,
  IconEdit,
  IconFileInvoice,
  IconFileText,
  IconLayoutDashboard,
  IconReceiptOff,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  ExpenseStatusDTO,
  type AmountByKeyDTO,
  type DashboardDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatTile, type TileIcon } from "@/components/dashboard/StatTile";
import { RankedBars } from "@/components/dashboard/Bars";
import { DonutChart } from "@/components/dashboard/charts";
import { themeSeries, useChartTheme } from "@/components/dashboard/chartTheme";
import {
  useGetBexioExpensesQuery,
  useGetDashboardQuery,
} from "@/store/slices/api";
import { formatChf, formatChfPrecise, formatDate } from "@/utils/format";
import { lastThreeMonths, type Period } from "@/utils/period";
import SyncPanel from "./SyncPanel";

const TILES: {
  status: ExpenseStatusDTO;
  icon: TileIcon;
  accent: string;
}[] = [
  {
    status: ExpenseStatusDTO.NEW,
    icon: IconFileText,
    accent: "var(--mantine-color-gray-6)",
  },
  {
    status: ExpenseStatusDTO.TO_REVIEW,
    icon: IconEdit,
    accent: "var(--mantine-color-orange-6)",
  },
  {
    status: ExpenseStatusDTO.READY,
    icon: IconChecklist,
    accent: "var(--mantine-color-blue-6)",
  },
  {
    status: ExpenseStatusDTO.BOOKED,
    icon: IconCircleCheck,
    accent: "var(--mantine-color-teal-6)",
  },
];

/**
 * Le tableau de bord : où en sont les pièces de la période (par statut), ce
 * qu'elles pèsent par compte de paiement et par type, les pièces Revolut à
 * demander, et l'état des synchronisations (bexio, lecture, Revolut).
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  // Période dans l'URL : le retour depuis une liste la retrouve.
  const [params, setParams] = useSearchParams();
  const period = useMemo<Period>(() => {
    const from = params.get("from");
    const to = params.get("to");
    return from && to ? { from, to } : lastThreeMonths();
  }, [params]);
  const setPeriod = (p: Period) =>
    setParams({ from: p.from, to: p.to }, { replace: true });
  const { data, isLoading } = useGetDashboardQuery(period);

  return (
    <Page maxWidth={1440}>
      <PageHeader
        icon={<IconLayoutDashboard size={22} stroke={1.7} />}
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />
      <Stack gap="lg">
        <PeriodPicker value={period} onChange={setPeriod} />
        <DashboardBody data={data} loading={isLoading} period={period} />
        <SyncPanel />
      </Stack>
    </Page>
  );
}

function DashboardBody({
  data,
  loading,
  period,
}: {
  data: DashboardDTO | undefined;
  loading: boolean;
  period: Period;
}) {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const query = (extra: Record<string, string>) =>
    new URLSearchParams({ ...period, ...extra }).toString();
  // Dépenses bexio à traiter : la liste, comptée ici (sans bexio : 409, pas de tuile).
  const {
    data: bexioExpenses,
    isLoading: bexioLoading,
    isError: bexioError,
  } = useGetBexioExpensesQuery(period);
  const bexioTodo = (bexioExpenses ?? []).filter((e) => e.issues.length > 0);

  // Couleurs à l'entité, dans l'ordre de la liste (jamais au rang).
  const byAccount = data?.byAccount ?? [];
  const accountParts = byAccount.map((row, index) => ({
    key: row.key ?? "none",
    label: row.key ? row.label : t("expenses.unclassified"),
    value: row.amountChf,
    color: row.key ? themeSeries(theme, index) : theme.other,
    display: formatChf(row.amountChf),
  }));
  const categoryRows = [...(data?.byCategory ?? [])]
    .sort((a, b) => b.amountChf - a.amountChf)
    .map((row: AmountByKeyDTO) => ({
      key: row.key ?? "none",
      label: (
        <Text
          size="sm"
          component={Link}
          to={`/expenses?${query({ category: row.key ?? "none" })}`}
          truncate
        >
          {row.key ? row.label : t("expenses.noCategory")}
        </Text>
      ),
      value: row.amountChf,
      display: formatChf(row.amountChf),
      hint: (
        <Text size="xs" c="dimmed">
          {t("dashboard.receipts", { count: row.count })}
        </Text>
      ),
    }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: bexioError ? 5 : 6 }}>
        {TILES.map(({ status, icon, accent }) => (
          <UnstyledButton
            key={status}
            component={Link}
            to={`/expenses?${query({ status })}`}
          >
            <StatTile
              label={t(`enum.expenseStatus.${status}`)}
              icon={icon}
              accent={accent}
              loading={loading}
              value={data?.byStatus[status] ?? 0}
              footer={
                <Text size="xs" c="dimmed">
                  {t(`dashboard.statusHint.${status}`)}
                </Text>
              }
            />
          </UnstyledButton>
        ))}
        <UnstyledButton
          component={Link}
          to={`/revolut?${query({ tab: "missing" })}`}
        >
          <StatTile
            label={t("dashboard.missing")}
            icon={IconReceiptOff}
            accent="var(--mantine-color-red-6)"
            loading={loading}
            value={data?.missingReceipts.count ?? 0}
            footer={
              <Text size="xs" c="dimmed">
                {t("dashboard.missingHint", {
                  amount: formatChfPrecise(data?.missingReceipts.amountChf),
                })}
              </Text>
            }
          />
        </UnstyledButton>
        {!bexioError && (
          <UnstyledButton
            component={Link}
            to={`/bexio-expenses?${query({ issue: "todo" })}`}
          >
            <StatTile
              label={t("dashboard.bexioTodo")}
              icon={IconFileInvoice}
              accent="var(--mantine-color-orange-6)"
              loading={bexioLoading}
              value={bexioTodo.length}
              footer={
                <Text size="xs" c="dimmed">
                  {t("dashboard.bexioTodoHint", {
                    count: bexioExpenses?.length ?? 0,
                  })}
                </Text>
              }
            />
          </UnstyledButton>
        )}
      </SimpleGrid>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <DashboardCard
            icon={IconBuildingBank}
            title={t("dashboard.byAccount")}
            description={
              data
                ? t("dashboard.periodTotal", {
                    from: formatDate(data.from),
                    to: formatDate(data.to),
                    total: formatChf(data.totalChf),
                  })
                : undefined
            }
            loading={loading}
            empty={!accountParts.some((p) => p.value > 0)}
            minHeight={200}
          >
            <DonutChart
              parts={accountParts}
              center={formatChf(data?.totalChf)}
              centerLabel={t("dashboard.total")}
            />
          </DashboardCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <DashboardCard
            icon={IconCategory}
            title={t("dashboard.byCategory")}
            description={t("dashboard.byCategoryHint")}
            loading={loading}
            empty={categoryRows.length === 0}
            minHeight={200}
          >
            <RankedBars rows={categoryRows} />
          </DashboardCard>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
