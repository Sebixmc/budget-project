import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data/accounts";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BANK_FORMATS } from "@/lib/parser";
import { AccountCard } from "./account-card";
import { createAccount } from "./actions";

export default async function SettingsPage() {
  const accounts = await getAccounts();
  const supabase = await createClient();

  // Transaction count per account (few accounts → a handful of count queries).
  const counts = await Promise.all(
    accounts.map(async (a) => {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("account_id", a.id);
      return [a.id, count ?? 0] as const;
    }),
  );
  const countMap = new Map(counts);

  return (
    <div>
      <PageHeader title="Settings" description="Manage your accounts." />

      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} txCount={countMap.get(a.id) ?? 0} />
        ))}
      </div>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Add an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <Input name="name" required placeholder="e.g. Sebi Checking" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Owner</span>
              <Input name="owner" placeholder="e.g. Sebi" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Type</span>
              <Select name="type" defaultValue="checking">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Bank format</span>
              <Select name="bank_format" defaultValue="capital_one_bank">
                {Object.entries(BANK_FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Add account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
