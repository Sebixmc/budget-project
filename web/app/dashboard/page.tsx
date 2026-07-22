import { redirect } from "next/navigation";
import { Landmark, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BANK_FORMATS, type BankFormat } from "@/lib/parser";

type AccountRow = {
  id: string;
  name: string;
  type: string;
  owner: string;
  bank_format: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS ensures this only ever returns THIS user's accounts.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type, owner, bank_format")
    .order("created_at", { ascending: true });

  const rows = (accounts ?? []) as AccountRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            L
          </span>
          Ledger
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </header>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-muted-foreground">
        Your accounts are ready. Import a statement to see your spending come to life.
      </p>

      <section className="grid gap-4 sm:grid-cols-2">
        {rows.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="size-4 text-primary" />
                {a.name}
              </CardTitle>
              <Badge variant="secondary">{a.owner}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {a.type} · {BANK_FORMATS[a.bank_format as BankFormat] ?? a.bank_format}
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Transactions, budgets, and insights land in the next releases.
      </p>
    </div>
  );
}
