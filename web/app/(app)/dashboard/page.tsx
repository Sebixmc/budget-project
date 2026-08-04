import Link from "next/link";
import { Upload } from "lucide-react";
import { getAccounts } from "@/lib/data/accounts";
import { getInsights, getSunburstRows } from "@/lib/data/insights";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SpendBarChart } from "@/components/charts/insight-charts";
import { SpendingSunburst } from "@/components/charts/spending-sunburst";
import { formatCurrency } from "@/lib/utils";

type SearchParams = Promise<{ month?: string; account?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const scope = { month: sp.month || undefined, accountId: sp.account || undefined };
  const [accounts, insights, sunburstRows] = await Promise.all([
    getAccounts(),
    getInsights(scope),
    getSunburstRows(scope),
  ]);
  const empty = insights.txCount === 0 && insights.monthlyTotals.length === 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={sp.month ? `Showing ${sp.month}` : "All time"}
      >
        <form className="flex items-center gap-2">
          <Input type="month" name="month" defaultValue={sp.month} aria-label="Month" className="h-9 w-auto" />
          <Select name="account" defaultValue={sp.account ?? ""} aria-label="Account" className="w-40">
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
      </PageHeader>

      {empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">No transactions yet. Import a statement to begin.</p>
            <Button asChild>
              <Link href="/upload">
                <Upload /> Import statement
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Spent" value={insights.totalSpent} tone="negative" />
            <KpiCard label="Income" value={insights.totalIncome} tone="positive" />
            <KpiCard label="Net" value={insights.net} tone={insights.net >= 0 ? "positive" : "negative"} />
            <KpiCard label="Transactions" value={insights.txCount} isCurrency={false} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly spending</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendBarChart data={insights.monthlyTotals} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By category</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendingSunburst rows={sunburstRows} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Category breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryTable rows={insights.byCategory} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top merchants</CardTitle>
              </CardHeader>
              <CardContent>
                <MerchantList rows={insights.topMerchants} />
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

function CategoryTable({ rows }: { rows: { category: string; amount: number; pct: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No spending.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.category} className="border-b border-border/60 last:border-0">
            <td className="py-2">{r.category}</td>
            <td className="tabular py-2 text-right text-muted-foreground">{r.pct}%</td>
            <td className="tabular py-2 pl-4 text-right font-medium">{formatCurrency(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MerchantList({ rows }: { rows: { description: string; amount: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No spending.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.description} className="border-b border-border/60 last:border-0">
            <td className="truncate py-2 pr-4">{r.description}</td>
            <td className="tabular py-2 text-right font-medium">{formatCurrency(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
