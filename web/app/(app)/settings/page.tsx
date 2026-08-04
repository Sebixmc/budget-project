import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data/accounts";
import { getCategoryUsage } from "@/lib/data/categories";
import { getUserSettings } from "@/lib/data/settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsSection } from "@/components/app/settings-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BANK_FORMATS } from "@/lib/parser";
import { AccountCard } from "./account-card";
import { AppearanceCard } from "./appearance-card";
import { CategoryManager } from "./category-manager";
import { PreferencesCard } from "./preferences-card";
import { SecurityCard } from "./security-card";
import { DataCard } from "./data-card";
import { createAccount } from "./actions";

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "accounts", label: "Accounts" },
  { id: "categories", label: "Categories" },
  { id: "preferences", label: "Budget" },
  { id: "security", label: "Profile & security" },
  { id: "data", label: "Data & privacy" },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    accounts,
    categories,
    settings,
    {
      data: { user },
    },
    { data: incomeRow },
  ] = await Promise.all([
    getAccounts(),
    getCategoryUsage(),
    getUserSettings(),
    supabase.auth.getUser(),
    supabase.from("budget_income").select("monthly_estimate").maybeSingle(),
  ]);

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
  const totalTx = categories.reduce((sum, c) => sum + c.txCount, 0);
  const income = incomeRow
    ? Number((incomeRow as { monthly_estimate: string | number }).monthly_estimate)
    : 0;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your accounts, appearance, and data." />

      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-10">
        <nav className="mb-6 hidden lg:block">
          <ul className="sticky top-6 flex flex-col gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex max-w-3xl flex-col gap-10">
          <SettingsSection
            id="appearance"
            title="Appearance"
            description="Light, dark, or match your device."
          >
            <AppearanceCard />
          </SettingsSection>

          <SettingsSection
            id="accounts"
            title="Accounts"
            description="Your bank accounts and how their CSVs are parsed."
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {accounts.map((a) => (
                  <AccountCard key={a.id} account={a} txCount={countMap.get(a.id) ?? 0} />
                ))}
                {accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No accounts yet — add one below.</p>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="mb-3 text-sm font-medium">Add an account</h3>
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
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="categories"
            title="Categories"
            description="Rename, merge, or delete the categories on your transactions."
          >
            <CategoryManager categories={categories} />
          </SettingsSection>

          <SettingsSection
            id="preferences"
            title="Budget preferences"
            description="Income estimate and where you land after signing in."
          >
            <PreferencesCard income={income} defaultPage={settings.default_page} />
          </SettingsSection>

          <SettingsSection id="security" title="Profile & security">
            <SecurityCard email={user?.email ?? ""} />
          </SettingsSection>

          <SettingsSection
            id="data"
            title="Data & privacy"
            description="Export your data or clear it out."
          >
            <DataCard txCount={totalTx} />
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
