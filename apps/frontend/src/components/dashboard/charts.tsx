import { useMemo } from "react";
import type { ReactNode } from "react";
import { Box, Group, Stack, Text } from "@mantine/core";
import { DashboardChart } from "./DashboardChart";
import {
  areaGradient,
  barGradient,
  baseOption,
  categoryAxis,
  useChartTheme,
  valueAxis,
  withAlpha,
} from "./chartTheme";
import classes from "./dashboard.module.css";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/** La légende d'un graphique, en HTML : elle passe à la ligne, elle se lit. */
export function ChartLegend({
  items,
}: {
  items: { key: string; label: string; color: string }[];
}) {
  return (
    <Group gap="md" justify="center" className={classes.legend}>
      {items.map((item) => (
        <Group key={item.key} gap={6} wrap="nowrap">
          <span className={classes.swatch} style={{ background: item.color }} />
          <Text size="xs" c="dimmed">
            {item.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}

/**
 * Des courbes dans le temps, en aires dégradées, un réticule et une
 * infobulle qui donne toutes les séries du jour. **Un seul axe** : les séries
 * superposées sont dans la même grandeur.
 */
export function TrendChart({
  categories,
  series,
  format,
  height = 260,
  area = true,
  smooth = true,
  reference,
}: {
  categories: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  height?: number;
  area?: boolean;
  smooth?: boolean;
  /** Une ligne de référence en tirets (la moyenne de la période). */
  reference?: { value: number; label: string };
}) {
  const theme = useChartTheme();
  const option = useMemo(
    () => ({
      ...baseOption(theme),
      grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        ...baseOption(theme).tooltip,
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: theme.axis, width: 1, type: "dashed" },
        },
        valueFormatter: (value: number) => format(value),
      },
      xAxis: { ...categoryAxis(theme, categories), boundaryGap: false },
      yAxis: valueAxis(theme, format),
      series: series.map((s) => ({
        name: s.label,
        type: "line",
        data: s.values,
        smooth: smooth ? 0.3 : false,
        smoothMonotone: "x",
        showSymbol: false,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 2.5, color: s.color },
        itemStyle: {
          color: s.color,
          borderColor: theme.surface,
          borderWidth: 2,
        },
        emphasis: { focus: "series" },
        areaStyle: area ? { color: areaGradient(s.color) } : undefined,
        markLine:
          reference && s === series[0]
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: theme.muted, type: "dashed", width: 1 },
                label: {
                  position: "insideEndTop",
                  color: theme.muted,
                  fontSize: 11,
                  formatter: `${reference.label} ${format(reference.value)}`,
                },
                data: [{ yAxis: reference.value }],
              }
            : undefined,
      })),
    }),
    [theme, categories, series, format, area, smooth, reference],
  );
  return (
    <Stack gap={6}>
      <DashboardChart option={option} height={height} />
      {series.length > 1 && <ChartLegend items={series} />}
    </Stack>
  );
}

/**
 * Des colonnes, empilées quand il y a plusieurs séries (un tout qui se
 * partage). Les segments sont séparés d'un filet de la couleur du fond.
 */
export function ColumnChart({
  categories,
  series,
  format,
  height = 220,
  stacked = true,
  highlightMax = false,
}: {
  categories: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  height?: number;
  stacked?: boolean;
  /** Une seule série : la plus haute colonne porte sa valeur. */
  highlightMax?: boolean;
}) {
  const theme = useChartTheme();
  const option = useMemo(() => {
    const single = series.length === 1;
    const max = single ? Math.max(...series[0].values, 0) : 0;
    return {
      ...baseOption(theme),
      grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        ...baseOption(theme).tooltip,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: withAlpha(theme.accent, 0.08) },
        },
        valueFormatter: (value: number) => format(value),
      },
      xAxis: categoryAxis(theme, categories),
      yAxis: valueAxis(theme, format),
      series: series.map((s, index) => ({
        name: s.label,
        type: "bar",
        stack: stacked && !single ? "total" : undefined,
        barMaxWidth: 28,
        barGap: "20%",
        data: s.values.map((value) => ({
          value,
          label:
            highlightMax && single && value === max && max > 0
              ? {
                  show: true,
                  position: "top",
                  color: theme.text,
                  fontWeight: 600,
                  fontSize: 11,
                  formatter: () => format(value),
                }
              : undefined,
        })),
        itemStyle: {
          color: single ? barGradient(s.color) : s.color,
          borderRadius:
            stacked && !single && index < series.length - 1
              ? [0, 0, 0, 0]
              : [5, 5, 0, 0],
          borderColor: theme.surface,
          borderWidth: stacked && !single ? 1 : 0,
        },
        emphasis: {
          itemStyle: {
            color: s.color,
            shadowBlur: 12,
            shadowColor: withAlpha(s.color, 0.4),
          },
        },
      })),
    };
  }, [theme, categories, series, format, stacked, highlightMax]);
  return (
    <Stack gap={6}>
      <DashboardChart option={option} height={height} />
      {series.length > 1 && <ChartLegend items={series} />}
    </Stack>
  );
}

export interface DonutPart {
  key: string;
  label: string;
  value: number;
  color: string;
  display: string;
}

/**
 * Un anneau : un tout partagé en parts, le total au centre, la liste à côté
 * (noms et chiffres) qui tient lieu de légende.
 */
export function DonutChart({
  parts,
  center,
  centerLabel,
  size = 180,
  withList = true,
}: {
  parts: DonutPart[];
  center: ReactNode;
  centerLabel?: ReactNode;
  size?: number;
  withList?: boolean;
}) {
  const theme = useChartTheme();
  const option = useMemo(
    () => ({
      ...baseOption(theme),
      tooltip: {
        ...baseOption(theme).tooltip,
        trigger: "item",
        formatter: (params: { dataIndex: number; percent: number }) => {
          const part = parts.filter((p) => p.value > 0)[params.dataIndex];
          return part
            ? `<b>${part.label}</b><br/>${part.display} · ${Math.round(params.percent)} %`
            : "";
        },
      },
      series: [
        {
          type: "pie",
          radius: ["68%", "92%"],
          padAngle: 2,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderRadius: 6 },
          emphasis: { scale: true, scaleSize: 4 },
          data: parts
            .filter((part) => part.value > 0)
            .map((part) => ({
              name: part.label,
              value: part.value,
              itemStyle: { color: part.color },
            })),
        },
      ],
    }),
    [theme, parts],
  );
  return (
    <Group gap="lg" wrap="wrap" justify="center" align="center">
      <Box pos="relative" w={size} h={size} style={{ flex: "none" }}>
        <DashboardChart option={option} height={size} />
        <div className={classes.donutCenter}>
          <div className={classes.donutValue}>{center}</div>
          {centerLabel && (
            <Text size="xs" c="dimmed" ta="center" lh={1.2}>
              {centerLabel}
            </Text>
          )}
        </div>
      </Box>
      {withList && (
        <Stack gap={6} style={{ flex: 1, minWidth: 180 }}>
          {parts.map((part) => (
            <Group
              key={part.key}
              justify="space-between"
              gap="xs"
              wrap="nowrap"
            >
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <span
                  className={classes.swatch}
                  style={{ background: part.color }}
                />
                <Text size="sm" truncate>
                  {part.label}
                </Text>
              </Group>
              <Text size="sm" fw={600} className={classes.numeric}>
                {part.display}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Group>
  );
}

/**
 * Un taux sur un anneau de progression, la valeur au centre. `null` : pas de
 * dénominateur, l'anneau reste vide et le centre dit « — ».
 */
export function RingGauge({
  value,
  display,
  color,
  size = 120,
  label,
  track,
}: {
  value: number | null;
  display: string;
  color: string;
  size?: number;
  label?: ReactNode;
  /** Couleur de la piste (sur un fond sombre, par exemple). */
  track?: string;
}) {
  const theme = useChartTheme();
  const option = useMemo(
    () => ({
      series: [
        {
          type: "gauge",
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 1,
          radius: "92%",
          pointer: { show: false },
          progress: {
            show: true,
            roundCap: true,
            width: Math.max(8, size / 11),
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: withAlpha(color, 0.75) },
                  { offset: 1, color },
                ],
              },
              shadowBlur: 10,
              shadowColor: withAlpha(color, 0.35),
            },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: Math.max(8, size / 11),
              color: [[1, track ?? theme.track]],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: { show: false },
          title: { show: false },
          animationDuration: 1100,
          data: [{ value: Math.min(Math.max(value ?? 0, 0), 1) }],
        },
      ],
    }),
    [theme, value, color, size, track],
  );
  return (
    <Stack gap={6} align="center">
      <Box pos="relative" w={size} h={size}>
        <DashboardChart option={option} height={size} />
        <div className={classes.donutCenter}>
          <div
            className={classes.gaugeValue}
            style={{ fontSize: Math.max(16, size / 5.2) }}
          >
            {display}
          </div>
        </div>
      </Box>
      {label}
    </Stack>
  );
}

/** Une courbe minuscule dans une tuile : la forme, pas les chiffres. */
export function Sparkline({
  values,
  color,
  height = 44,
  format,
  labels,
}: {
  values: number[];
  color: string;
  height?: number;
  format?: (value: number) => string;
  labels?: string[];
}) {
  const theme = useChartTheme();
  const option = useMemo(
    () => ({
      ...baseOption(theme),
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      tooltip: format
        ? {
            ...baseOption(theme).tooltip,
            trigger: "axis",
            axisPointer: { type: "none" },
            valueFormatter: (value: number) => format(value),
          }
        : undefined,
      xAxis: {
        type: "category",
        show: false,
        boundaryGap: false,
        data: labels ?? values.map((_, i) => String(i)),
      },
      yAxis: { type: "value", show: false, min: 0 },
      series: [
        {
          type: "line",
          data: values,
          smooth: 0.3,
          smoothMonotone: "x",
          showSymbol: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: { color: areaGradient(color, 0.3, 0) },
        },
      ],
    }),
    [theme, values, color, format, labels],
  );
  if (values.length < 2) return <Box h={height} />;
  return <DashboardChart option={option} height={height} />;
}

/**
 * Des barres horizontales de part et d'autre d'un axe : ce qui entre à
 * droite, ce qui sort à gauche (flux par lieu). Un seul axe, une seule
 * grandeur ; les valeurs de gauche s'écrivent sans signe.
 */
export function DivergingBarChart({
  categories,
  positive,
  negative,
  format,
  height,
}: {
  categories: string[];
  positive: ChartSeries;
  negative: ChartSeries;
  format: (value: number) => string;
  height?: number;
}) {
  const theme = useChartTheme();
  const option = useMemo(
    () => ({
      ...baseOption(theme),
      grid: { left: 8, right: 16, top: 8, bottom: 4, containLabel: true },
      tooltip: {
        ...baseOption(theme).tooltip,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: withAlpha(theme.accent, 0.08) },
        },
        valueFormatter: (value: number) => format(Math.abs(value)),
      },
      xAxis: {
        ...valueAxis(theme, (value: number) => format(Math.abs(value))),
        minInterval: undefined,
      },
      yAxis: {
        ...categoryAxis(theme, categories),
        axisLabel: { color: theme.text, fontSize: 12, fontWeight: 600 },
      },
      series: [
        {
          name: positive.label,
          type: "bar",
          stack: "flow",
          barMaxWidth: 18,
          data: positive.values,
          itemStyle: {
            color: barGradient(positive.color, true),
            borderRadius: [0, 5, 5, 0],
          },
        },
        {
          name: negative.label,
          type: "bar",
          stack: "flow",
          barMaxWidth: 18,
          data: negative.values.map((value) => -Math.abs(value)),
          itemStyle: { color: negative.color, borderRadius: [5, 0, 0, 5] },
        },
      ],
    }),
    [theme, categories, positive, negative, format],
  );
  return (
    <Stack gap={6}>
      <DashboardChart
        option={option}
        height={height ?? Math.max(160, categories.length * 34 + 30)}
      />
      <ChartLegend items={[positive, negative]} />
    </Stack>
  );
}
