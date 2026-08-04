import { getBudget } from "@/lib/data/budget";
import { selectIncome } from "@/lib/charts/sankey-data";
import { computeCascade } from "@/lib/budget-math";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetSankey } from "@/components/charts/budget-sankey";
import { BudgetBuilder } from "./budget-builder";

export default async function BudgetPage() {
  const data = await getBudget();

  const expenseLimits = data.categories
    .filter((c) => c.flow_type === "expense")
    .map((c) => ({ category: c.category, limit: c.monthly_limit }));

  // Sankey income by priority: builder profile (after-tax monthly) → user's
  // monthly estimate → historical average. Savings goals branch only when a
  // profile drives the numbers (specs/budget-builder.md §8).
  const cascade =
    data.profile && data.profile.gross_annual > 0
      ? computeCascade({
          grossAnnual: data.profile.gross_annual,
          taxLines: data.profile.tax_lines,
          goals: data.goals.map((g) => ({ monthlyAmount: g.monthly_amount })),
          expenseLimits: [],
        })
      : null;
  const { income, label } = selectIncome(data.income, data.avgIncome, cascade?.monthlyAfterTax);
  const savingsGoals = cascade
    ? data.goals
        .filter((g) => g.monthly_amount > 0)
        .map((g) => ({ name: g.name, monthly: g.monthly_amount }))
    : undefined;
  const hasSankey = expenseLimits.some((c) => c.limit > 0) || (savingsGoals?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Budget"
        description="Follow the paycheck: yearly facts, then monthly choices."
      />
      <div className="flex flex-col gap-6">
        {hasSankey && (
          <Card>
            <CardHeader>
              <CardTitle>Where the paycheck goes</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetSankey
                income={income}
                incomeLabel={label}
                expenseLimits={expenseLimits}
                savingsGoals={savingsGoals}
              />
            </CardContent>
          </Card>
        )}
        <BudgetBuilder data={data} />
      </div>
    </div>
  );
}
