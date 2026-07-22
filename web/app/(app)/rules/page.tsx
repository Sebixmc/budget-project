import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALL_CATEGORIES } from "@/lib/categorizer";
import { createRule, deleteRule, reapplyRules } from "./actions";

type Rule = { id: string; pattern: string; category: string; created_at: string };

export default async function RulesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchant_rules")
    .select("id, pattern, category, created_at")
    .order("created_at", { ascending: false });
  const rules = (data ?? []) as Rule[];

  return (
    <div>
      <PageHeader title="Rules" description="Auto-categorize merchants you've named.">
        {rules.length > 0 && (
          <form action={reapplyRules}>
            <Button type="submit" size="sm" variant="outline">
              Re-apply to existing
            </Button>
          </form>
        )}
      </PageHeader>

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Add a rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRule} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">When description contains</span>
              <Input name="pattern" required placeholder="e.g. starbucks" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Categorize as</span>
              <Select name="category" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" size="sm">
              Add rule
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Rules beat keyword matching and apply to future imports. Manual edits are never
            overwritten.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5">{r.pattern}</code>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline">{r.category}</Badge>
                  </div>
                  <form action={deleteRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button size="icon" variant="ghost" type="submit" aria-label="Delete rule">
                      <Trash2 className="text-negative" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
