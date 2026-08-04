import { getBudget } from "@/lib/data/budget";
import { selectIncome } from "@/lib/charts/sankey-data";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetSankey } from "@/components/charts/budget-sankey";
import { BudgetPlanner } from "./budget-planner";

export default async function BudgetPage() {
  const data = await getBudget();

  // Sankey inputs: budgeted expense categories + the income figure the
  // planner already uses (estimate, else historical average).
  const expenseLimits = data.categories
    .filter((c) => c.flow_type === "expense")
    .map((c) => ({ category: c.category, limit: c.monthly_limit }));
  const { income, label } = selectIncome(data.income, data.avgIncome);
  const hasSankey = expenseLimits.some((c) => c.limit > 0);

  return (
    <div>
      <PageHeader
        title="Budget"
        description="Plan what your budget should be — informed by your historical averages."
      />
      <div className="flex flex-col gap-6">
        {hasSankey && (
          <Card>
            <CardHeader>
              <CardTitle>Where the paycheck goes</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetSankey income={income} incomeLabel={label} expenseLimits={expenseLimits} />
            </CardContent>
          </Card>
        )}
        <BudgetPlanner data={data} />
      </div>
    </div>
  );
}
