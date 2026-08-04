"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";

/**
 * Thin client-only ECharts wrapper. The tree-shaken echarts modules load via
 * dynamic import on mount (never during SSR), the chart resizes with its
 * container via ResizeObserver, and everything is disposed on unmount.
 */
export function EChart({
  option,
  className,
  ariaLabel,
}: {
  option: EChartsCoreOption;
  className?: string;
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      const [core, { SunburstChart, SankeyChart }, { TooltipComponent }, { CanvasRenderer }] =
        await Promise.all([
          import("echarts/core"),
          import("echarts/charts"),
          import("echarts/components"),
          import("echarts/renderers"),
        ]);
      core.use([SunburstChart, SankeyChart, TooltipComponent, CanvasRenderer]);
      if (disposed) return;

      const chart = core.init(el);
      chart.setOption(optionRef.current);
      chartRef.current = chart;

      observer = new ResizeObserver(() => chart.resize());
      observer.observe(el);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // Prop changes after mount re-apply the option (notMerge resets stale state).
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
}
