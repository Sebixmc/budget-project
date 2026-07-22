import { getBudget } from "@/lib/data/budget";
import { PageHeader } from "@/components/app/page-header";
import { BudgetPlanner } from "./budget-planner";

export default async function BudgetPage() {
  const data = await getBudget();
  return (
    <div>
      <PageHeader
        title="Budget"
        description="Plan what your budget should be — informed by your historical averages."
      />
      <BudgetPlanner data={data} />
    </div>
  );
}
