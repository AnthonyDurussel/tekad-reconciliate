import { useEffect, useRef } from "react";
import { Box } from "@mantine/core";
import * as echarts from "echarts/core";
import { BarChart, GaugeChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Seuls les modules utilisés sont chargés : ECharts entier pèse un mégaoctet.
echarts.use([
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type ChartOption = echarts.EChartsCoreOption;

/**
 * Un graphique ECharts dans un bloc de hauteur fixe. L'instance vit avec le
 * composant ; chaque nouvelle option la remplace entièrement (`notMerge`).
 * La taille suit le conteneur.
 */
export function DashboardChart({
  option,
  height,
  ariaLabel,
}: {
  /** Une option ECharts : les littéraux (« line », « axis ») ne s'y typent pas. */
  option: object;
  height: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | undefined>(undefined);

  useEffect(() => {
    const instance = echarts.init(ref.current!, undefined, {
      renderer: "canvas",
    });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option as ChartOption, {
      notMerge: true,
    });
  }, [option]);

  return <Box ref={ref} h={height} role="img" aria-label={ariaLabel} />;
}
