import type { ReactNode } from "react";
import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { formatRate } from "./dashboardFormat";
import classes from "./dashboard.module.css";

export interface RankedRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Ce qu'on écrit au bout de la barre. */
  display: string;
  hint?: ReactNode;
}

/**
 * Des barres classées, la plus longue d'abord, **une seule teinte** : la
 * longueur est l'information, la valeur est écrite au bout. Des barres en
 * CSS plutôt qu'un graphique : dix lignes et un libellé ne le justifient pas,
 * et une ligne garde son nom lisible sur un téléphone.
 */
export function RankedBars({
  rows,
  color = "var(--dashboard-series-1)",
  ranked = true,
}: {
  rows: RankedRow[];
  color?: string;
  /** Numérote les lignes (1, 2, 3…) : c'est un classement. */
  ranked?: boolean;
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0);
  return (
    <Stack gap={12}>
      {rows.map((row, index) => (
        <Group key={row.key} gap="sm" wrap="nowrap" align="flex-start">
          {ranked && (
            <span
              className={`${classes.rank} ${index === 0 ? classes.rankFirst : ""}`}
            >
              {index + 1}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <Group justify="space-between" gap="xs" wrap="nowrap" mb={4}>
              <div style={{ minWidth: 0, flex: 1 }}>{row.label}</div>
              <Text size="sm" fw={700} className={classes.numeric}>
                {row.display}
              </Text>
            </Group>
            <div className={classes.meter} style={{ height: 7 }}>
              <div
                className={classes.meterFill}
                style={{
                  width: max > 0 ? `${(Math.abs(row.value) / max) * 100}%` : 0,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
                }}
              />
            </div>
            {row.hint}
          </div>
        </Group>
      ))}
    </Stack>
  );
}

export interface SegmentPart {
  key: string;
  label: string;
  value: number;
  color: string;
  display: string;
}

/**
 * Un tout partagé en parts, d'un coup d'œil : une barre fine sans texte, et
 * la liste dessous qui porte les noms et les chiffres (une pastille par
 * ligne tient lieu de légende).
 */
export function SegmentedBar({
  parts,
  withList = true,
}: {
  parts: SegmentPart[];
  withList?: boolean;
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(part.value, 0), 0);
  return (
    <Stack gap={6}>
      <div
        className={classes.segments}
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.display}`).join(", ")}
      >
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <Tooltip key={part.key} label={`${part.label} · ${part.display}`}>
              <div
                className={classes.segment}
                style={{
                  width: `${(part.value / total) * 100}%`,
                  background: part.color,
                }}
              />
            </Tooltip>
          ))}
      </div>
      {withList && (
        <Stack gap={2}>
          {parts.map((part) => (
            <Group
              key={part.key}
              justify="space-between"
              gap="xs"
              wrap="nowrap"
            >
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <span
                  className={classes.swatch}
                  style={{ background: part.color }}
                />
                <Text size="sm" truncate>
                  {part.label}
                </Text>
              </Group>
              <Text size="sm" className={classes.numeric}>
                {part.display}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** Une jauge : un taux sur sa piste, la valeur écrite à côté. */
export function Meter({
  rate,
  color = "var(--dashboard-series-1)",
  label,
}: {
  rate: number | null;
  color?: string;
  label?: ReactNode;
}) {
  return (
    <div>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <div style={{ minWidth: 0, flex: 1 }}>{label}</div>
        <Text size="sm" fw={600} className={classes.numeric}>
          {formatRate(rate, 1)}
        </Text>
      </Group>
      <div className={classes.meter}>
        <div
          className={classes.meterFill}
          style={{
            width: `${Math.min(Math.max(rate ?? 0, 0), 1) * 100}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
          }}
        />
      </div>
    </div>
  );
}
