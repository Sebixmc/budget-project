import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createRule, deleteRule, reapplyRules } from "../rules/actions";

type Rule = { id: string; pattern: string; category: string; created_at: string };

/**
 * Merchant auto-categorization rules, embedded as a niche Settings section
 * (no longer a top-level nav tab). Rules beat keyword matching on future
 * imports; manual edits are never overwritten (hard rule #7).
 */
export function RulesManager({ rules, categories }: { rules: Rule[]; categories: string[] }) {
  return (
    <div className="flex flex-col gap-6">
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
            {categories.map((c) => (
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
      <p className="-mt-3 text-xs text-muted-foreground">
        Rules beat keyword matching and apply to future imports. Manual edits are never overwritten.
      </p>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Your rules</h3>
          {rules.length > 0 && (
            <form action={reapplyRules}>
              <Button type="submit" size="sm" variant="outline">
                Re-apply to existing
              </Button>
            </form>
          )}
        </div>
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
      </div>
    </div>
  );
}
