"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./echarts";
import { buildSunburstTree, type SunburstRow } from "@/lib/charts/sunburst-data";
import {
  CHART_NEUTRALS,
  FLOW_COLORS,
  ON_WEDGE_TEXT,
  cssVarTooltipStyle,
  isDarkTheme,
  paletteColor,
} from "@/lib/charts/palette";
import { formatCurrency } from "@/lib/utils";

/**
 * Three-ring drill-down sunburst: flow (Spending/Income) → category →
 * merchant. Clicking a wedge zooms it to the root (ECharts nodeClick
 * 'rootToNode'); clicking the center circle zooms back out one level.
 */
export function SpendingSunburst({ rows }: { rows: SunburstRow[] }) {
  const option = useMemo<EChartsCoreOption | null>(() => {
    const tree = buildSunburstTree(rows);
    if (tree.length === 0) return null;

    // Flow ring gets the semantic income/spending colors; categories cycle
    // through the shared palette; merchant leaves inherit their category.
    let catIndex = 0;
    const data = tree.map((flowNode) => ({
      ...flowNode,
      itemStyle: {
        color: flowNode.name === "Income" ? FLOW_COLORS.income : FLOW_COLORS.spending,
      },
      children: flowNode.children?.map((cat) => ({
        ...cat,
        itemStyle: { color: paletteColor(catIndex++) },
      })),
    }));

    const neutrals = CHART_NEUTRALS[isDarkTheme() ? "dark" : "light"];
    return {
      tooltip: {
        ...cssVarTooltipStyle,
        formatter: (p: unknown) => {
          const { name, value } = p as { name: string; value?: number };
          return `${name}: ${formatCurrency(Number(value ?? 0))}`;
        },
      },
      series: [
        {
          type: "sunburst",
          data,
          radius: [28, "92%"],
          nodeClick: "rootToNode",
          emphasis: { focus: "ancestor" },
          itemStyle: { borderColor: neutrals.border, borderWidth: 1 },
          // Tiny wedges stay clickable but unlabeled; labels truncate.
          label: {
            rotate: "radial",
            fontSize: 10,
            minAngle: 8,
            color: ON_WEDGE_TEXT,
            overflow: "truncate",
            width: 76,
          },
        },
      ],
    };
  }, [rows]);

  if (!option) {
    return <p className="text-sm text-muted-foreground">No transactions in this scope.</p>;
  }
  return <EChart option={option} className="h-[320px] w-full" ariaLabel="Spending by flow, category and merchant" />;
}
