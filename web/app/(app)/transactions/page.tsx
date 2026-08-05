import Link from "next/link";
import { getAccounts } from "@/lib/data/accounts";
import { getTransactions, type Flow } from "@/lib/data/transactions";
import { getSelectableCategories } from "@/lib/data/categories";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionsTable } from "./transactions-table";

type SearchParams = Promise<{
  month?: string;
  account?: string;
  category?: string;
  flow?: string;
  q?: string;
  hideTransfers?: string;
}>;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [accounts, categories] = await Promise.all([getAccounts(), getSelectableCategories()]);
  const transactions = await getTransactions({
    month: sp.month || undefined,
    accountId: sp.account || undefined,
    category: sp.category || undefined,
    flow: (sp.flow as Flow) || undefined,
    search: sp.q || undefined,
    hideTransfers: sp.hideTransfers === "1",
  });

  return (
    <div>
      <PageHeader title="Transactions" description={`${transactions.length} shown`} />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Input type="month" name="month" defaultValue={sp.month} aria-label="Month" />
            <Select name="account" defaultValue={sp.account ?? ""} aria-label="Account">
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select name="category" defaultValue={sp.category ?? ""} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select name="flow" defaultValue={sp.flow ?? ""} aria-label="Flow">
              <option value="">Spending &amp; income</option>
              <option value="debit">Spending</option>
              <option value="credit">Income</option>
            </Select>
            <Input type="search" name="q" placeholder="Search description" defaultValue={sp.q} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hideTransfers" value="1" defaultChecked={sp.hideTransfers === "1"} />
              Hide transfers
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/transactions">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TransactionsTable transactions={transactions} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
