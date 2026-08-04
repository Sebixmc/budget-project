import { getAccounts } from "@/lib/data/accounts";
import { getMonthlyReport } from "@/lib/data/insights";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";
import { TrendLineChart } from "@/components/charts/insight-charts";
import { cn, formatCurrency, formatMonthLabel } from "@/lib/utils";

type SearchParams = Promise<{ month?: string; account?: string }>;

export default async function MonthlyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const month = sp.month || new Date().toISOString().slice(0, 7);
  const accounts = await getAccounts();
  const report = await getMonthlyReport(month, sp.account || undefined);

  return (
    <div>
      <PageHeader title="Monthly" description={formatMonthLabel(month)}>
        <form className="flex items-center gap-2">
          <MonthPicker name="month" value={month} aria-label="Month" />
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

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Spent" value={report.spent} tone="negative" />
        <KpiCard label="Income" value={report.income} tone="positive" />
        <KpiCard label="Net" value={report.net} tone={report.net >= 0 ? "positive" : "negative"} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rolling averages
            </CardTitle>
          </CardHeader>
          <CardContent className="tabular text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spent</span>
              <span>{formatCurrency(report.avgSpent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span>{formatCurrency(report.avgIncome)}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Income vs spending</CardTitle>
        </CardHeader>
        <CardContent>
          {report.trend.length > 0 ? (
            <TrendLineChart data={report.trend} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories this month vs average</CardTitle>
        </CardHeader>
        <CardContent>
          {report.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spending this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">Category</th>
                    <th className="py-2 pr-4 text-right font-medium">This month</th>
                    <th className="py-2 pr-4 text-right font-medium">Avg / month</th>
                    <th className="py-2 text-right font-medium">Δ vs avg</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((c) => (
                    <tr key={c.category} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4">{c.category}</td>
                      <td className="tabular py-2 pr-4 text-right font-medium">{formatCurrency(c.amount)}</td>
                      <td className="tabular py-2 pr-4 text-right text-muted-foreground">{formatCurrency(c.avg)}</td>
                      <td
                        className={cn(
                          "tabular py-2 text-right",
                          c.delta > 0 ? "text-negative" : "text-positive",
                        )}
                      >
                        {c.delta > 0 ? "+" : ""}
                        {formatCurrency(c.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
