import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconMinus,
} from "@tabler/icons-react";
import { changeRatio, changeTone, formatChangeRatio } from "./dashboardFormat";
import classes from "./dashboard.module.css";

const TONE_COLOR = {
  good: "var(--dashboard-good)",
  bad: "var(--dashboard-bad)",
  neutral: "var(--mantine-color-dimmed)",
} as const;

/**
 * La variation contre la période précédente : une flèche **et** le texte
 * (« +12 % vs période préc. ») — la couleur dit si c'est une bonne nouvelle,
 * jamais seule.
 */
export function ChangeLine({
  current,
  previous,
  upIsGood,
}: {
  current: number;
  previous: number | null | undefined;
  upIsGood: boolean | null;
}) {
  const { t } = useTranslation();
  const ratio =
    previous === null || previous === undefined
      ? null
      : changeRatio(current, previous);
  const label = formatChangeRatio(ratio);
  if (label === null) {
    return (
      <Group gap={6} wrap="nowrap">
        <span
          className={classes.deltaPill}
          style={{ ["--delta-color" as string]: TONE_COLOR.neutral }}
        >
          <IconMinus size={12} stroke={2.5} aria-hidden />
        </span>
        <Text size="xs" c="dimmed" truncate>
          {t("dashboard.noReference")}
        </Text>
      </Group>
    );
  }
  const tone = changeTone(ratio, upIsGood);
  const Icon =
    ratio && ratio > 0
      ? IconArrowUpRight
      : ratio && ratio < 0
        ? IconArrowDownRight
        : IconMinus;
  return (
    <Group gap={6} wrap="nowrap">
      <span
        className={classes.deltaPill}
        style={{ ["--delta-color" as string]: TONE_COLOR[tone] }}
      >
        <Icon size={12} stroke={2.5} aria-hidden />
        {label}
      </span>
      <Text size="xs" c="dimmed" truncate>
        {t("dashboard.vsPrevious")}
      </Text>
    </Group>
  );
}

export type TileIcon = ComponentType<{ size?: number; stroke?: number }>;

/**
 * Une tuile de chiffre : l'icône et le libellé, la valeur en grand, la
 * variation dessous, et au besoin la courbe de la période en pied, à fond
 * perdu.
 */
export function StatTile({
  label,
  value,
  footer,
  loading,
  icon: Icon,
  accent = "var(--mantine-primary-color-filled)",
  trend,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  icon?: TileIcon;
  accent?: string;
  trend?: ReactNode;
}) {
  return (
    <Paper
      radius="lg"
      className={classes.kpi}
      style={{ ["--kpi-accent" as string]: accent }}
      h="100%"
    >
      <Stack gap={8} p="md" pb={trend ? 4 : "md"} style={{ flex: 1 }}>
        <Group gap="sm" wrap="nowrap" align="center">
          {Icon && (
            <span className={classes.kpiIcon}>
              <Icon size={18} stroke={1.8} />
            </span>
          )}
          <Text className={classes.kpiLabel} truncate>
            {label}
          </Text>
        </Group>
        {loading ? (
          <Skeleton h={34} w="60%" radius="md" />
        ) : (
          <div className={classes.tileValue}>{value}</div>
        )}
        {!loading && footer}
      </Stack>
      {trend && !loading && <div className={classes.kpiTrend}>{trend}</div>}
    </Paper>
  );
}
