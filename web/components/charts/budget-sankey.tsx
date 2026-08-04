"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./echarts";
import {
  buildBudgetSankey,
  type BudgetSankeyGraph,
  type ExpenseLimit,
} from "@/lib/charts/sankey-data";
import {
  CHART_NEUTRALS,
  FLOW_COLORS,
  NEUTRAL_NODE,
  cssVarTooltipStyle,
  isDarkTheme,
  paletteColor,
} from "@/lib/charts/palette";
import { formatCurrency } from "@/lib/utils";

/**
 * Income → allocation Sankey for the Budget page, with the meta line above
 * it: `Income $X · Budgeted $Y · Unallocated $Z`, or an over-allocated
 * warning when limits exceed income (links are never scaled or clipped).
 * Renders nothing when no expense category has a positive limit.
 */
export function BudgetSankey({
  income,
  incomeLabel,
  expenseLimits,
}: {
  income: number;
  incomeLabel: string;
  expenseLimits: ExpenseLimit[];
}) {
  const graph = useMemo(
    () => buildBudgetSankey({ income, incomeLabel, expenseLimits }),
    [income, incomeLabel, expenseLimits],
  );
  const option = useMemo<EChartsCoreOption | null>(() => graph && sankeyOption(graph), [graph]);

  if (!graph || !option) return null;
  const { meta } = graph;

  return (
    <div className="flex flex-col gap-2">
      {meta.overAllocated > 0 ? (
        <p className="text-sm">
          <span className="font-medium text-warning">
            ⚠ Over-allocated by {formatCurrency(meta.overAllocated)}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · Income {formatCurrency(meta.income)} · Budgeted {formatCurrency(meta.budgeted)}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Income {formatCurrency(meta.income)} · Budgeted {formatCurrency(meta.budgeted)} ·
          Unallocated {formatCurrency(meta.unallocated)}
        </p>
      )}
      <EChart option={option} className="h-[300px] w-full" ariaLabel="Income to budget allocation flow" />
    </div>
  );
}

function sankeyOption(graph: BudgetSankeyGraph): EChartsCoreOption {
  const theme = isDarkTheme() ? "dark" : "light";
  const neutrals = CHART_NEUTRALS[theme];

  let catIndex = 0;
  const nodeColor = (kind: "income" | "category" | "unallocated") => {
    if (kind === "income") return FLOW_COLORS.income;
    if (kind === "unallocated") return NEUTRAL_NODE[theme];
    return paletteColor(catIndex++);
  };

  return {
    tooltip: {
      ...cssVarTooltipStyle,
      trigger: "item",
      formatter: (p: unknown) => {
        const { dataType, name, value, data } = p as {
          dataType: string;
          name: string;
          value?: number;
          data?: { source?: string; target?: string };
        };
        if (dataType === "edge") {
          return `${data?.source} → ${data?.target} · ${formatCurrency(Number(value ?? 0))}`;
        }
        return `${name}: ${formatCurrency(Number(value ?? 0))}`;
      },
    },
    series: [
      {
        type: "sankey",
        data: graph.nodes.map((n) => ({ name: n.name, itemStyle: { color: nodeColor(n.kind) } })),
        links: graph.links,
        emphasis: { focus: "adjacency" },
        nodeWidth: 14,
        nodeGap: 12,
        left: 4,
        top: 8,
        bottom: 8,
        right: 130,
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
        label: { color: neutrals.text, fontSize: 12 },
        itemStyle: { borderWidth: 0 },
      },
    ],
  };
}
