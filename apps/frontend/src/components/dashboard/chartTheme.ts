import { useComputedColorScheme } from "@mantine/core";
import * as echarts from "echarts/core";

/**
 * Les teintes des graphiques, en clair et en sombre. Un canevas ne lit pas les
 * variables CSS : les valeurs sont écrites ici (reprises de stoll-stock-management). La
 * palette catégorielle est validée (skill dataviz) et s'attribue **dans son
 * ordre fixe**, à l'entité et jamais au rang.
 */
const PALETTES = {
  light: {
    series: [
      "#2a78d6",
      "#eb6834",
      "#1baf7a",
      "#eda100",
      "#e87ba4",
      "#008300",
      "#6250d6",
    ],
    other: "#898781",
    ordinal: ["#1c5cab", "#3987e5", "#86b6ef"],
    accent: "#0a9e46",
    good: "#1baf7a",
    bad: "#d03b3b",
    warn: "#eda100",
    text: "#2a2f32",
    muted: "#727a7e",
    grid: "rgba(13, 16, 18, 0.08)",
    axis: "rgba(13, 16, 18, 0.18)",
    surface: "#ffffff",
    track: "#e8edf1",
    tooltipBg: "rgba(255, 255, 255, 0.96)",
  },
  dark: {
    series: [
      "#3987e5",
      "#d95926",
      "#199e70",
      "#c98500",
      "#d55181",
      "#008300",
      "#9085e9",
    ],
    other: "#898781",
    ordinal: ["#86b6ef", "#3987e5", "#184f95"],
    accent: "#16db65",
    good: "#2bc28c",
    bad: "#e66767",
    warn: "#c98500",
    text: "#e6e9ea",
    muted: "#959c9f",
    grid: "rgba(255, 255, 255, 0.06)",
    axis: "rgba(255, 255, 255, 0.16)",
    surface: "#121517",
    track: "#1d2224",
    tooltipBg: "rgba(18, 21, 23, 0.96)",
  },
} as const;

export type ChartTheme = (typeof PALETTES)[keyof typeof PALETTES] & {
  dark: boolean;
};

export function useChartTheme(): ChartTheme {
  const scheme = useComputedColorScheme("light");
  return { ...PALETTES[scheme], dark: scheme === "dark" };
}

/** La teinte d'une série par son rang fixe ; au-delà, le gris « autres ». */
export function themeSeries(theme: ChartTheme, index: number) {
  return theme.series[index] ?? theme.other;
}

/** Un dégradé vertical d'une teinte vers la transparence (aires). */
export function areaGradient(color: string, from = 0.35, to = 0.02) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: withAlpha(color, from) },
    { offset: 1, color: withAlpha(color, to) },
  ]);
}

/** Un dégradé de barre : la teinte en haut, un pas plus claire en bas. */
export function barGradient(color: string, horizontal = false) {
  return new echarts.graphic.LinearGradient(
    0,
    0,
    horizontal ? 1 : 0,
    horizontal ? 0 : 1,
    horizontal
      ? [
          { offset: 0, color: withAlpha(color, 0.7) },
          { offset: 1, color },
        ]
      : [
          { offset: 0, color },
          { offset: 1, color: withAlpha(color, 0.65) },
        ],
  );
}

export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Ce que toutes les options partagent : police, infobulle, animation. */
export function baseOption(theme: ChartTheme) {
  return {
    textStyle: {
      fontFamily: "inherit",
      color: theme.muted,
    },
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: {
      // Rendue dans <body> : une carte (overflow: hidden) ne la coupe plus.
      appendTo: "body",
      backgroundColor: theme.tooltipBg,
      borderColor: theme.axis,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: theme.text, fontSize: 12 },
      extraCssText:
        "border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); backdrop-filter: blur(6px);",
    },
  };
}

/** Un axe des catégories discret : ni trait de graduation, ni ligne forte. */
export function categoryAxis(theme: ChartTheme, data: string[]) {
  return {
    type: "category",
    data,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: theme.axis } },
    axisLabel: { color: theme.muted, fontSize: 11, hideOverlap: true },
  };
}

/** Un axe des valeurs récessif : une grille fine en tirets, pas de ligne. */
export function valueAxis(
  theme: ChartTheme,
  format?: (value: number) => string,
) {
  return {
    type: "value",
    splitNumber: 4,
    minInterval: 1,
    axisLabel: {
      color: theme.muted,
      fontSize: 11,
      formatter: format,
    },
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
  };
}
