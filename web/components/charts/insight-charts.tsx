"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const AXIS = "var(--color-muted-foreground)";
const GRID = "var(--color-border)";

// Categorical palette (distinct hues at consistent lightness/chroma).
const PALETTE = [
  "oklch(0.62 0.14 163)",
  "oklch(0.6 0.15 250)",
  "oklch(0.65 0.17 40)",
  "oklch(0.7 0.15 90)",
  "oklch(0.55 0.2 320)",
  "oklch(0.6 0.13 200)",
  "oklch(0.63 0.19 20)",
  "oklch(0.68 0.13 135)",
  "oklch(0.58 0.16 290)",
];

function monthShort(m: string): string {
  const [, mm] = m.split("-");
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(mm)
  ];
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground)",
};

export function SpendBarChart({ data }: { data: { month: string; spent: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthShort} stroke={AXIS} fontSize={12} tickLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => formatCurrency(v, { cents: false })}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--color-muted)" }}
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(label) => monthShort(String(label))}
        />
        <Bar dataKey="spent" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: { category: string; amount: number }[] }) {
  const top = data.slice(0, 8);
  const rest = data.slice(8).reduce((s, d) => s + d.amount, 0);
  const slices = rest > 0 ? [...top, { category: "Other", amount: rest }] : top;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={slices} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {slices.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--color-card)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data }: { data: { month: string; spent: number; income: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthShort} stroke={AXIS} fontSize={12} tickLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => formatCurrency(v, { cents: false })}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(label) => monthShort(String(label))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="income" stroke="var(--color-positive)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="spent" stroke="var(--color-negative)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
