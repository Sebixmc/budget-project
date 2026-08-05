"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isReservedFromDelete, isReservedFromRename } from "@/lib/categories";
import type { CategoryUsage } from "@/lib/data/categories";
import { createCategory, deleteCategory, renameCategory } from "./actions";

function AddCategory({ existingNames }: { existingNames: string[] }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const duplicate =
    trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  function submit() {
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createCategory(value);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setValue("");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="New category name"
          aria-label="New category name"
          className="h-9 max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button size="sm" onClick={submit} disabled={pending || !trimmed || duplicate}>
          <Plus /> Add
        </Button>
        {duplicate && <Badge variant="warning">Already exists</Badge>}
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}

function CategoryRow({
  cat,
  existingNames,
}: {
  cat: CategoryUsage;
  existingNames: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cat.category);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lockedFromRename = isReservedFromRename(cat.category);
  const lockedFromDelete = isReservedFromDelete(cat.category);

  // Typing a name that already exists turns the rename into a merge.
  const trimmed = value.trim();
  const willMerge =
    trimmed.length > 0 &&
    trimmed !== cat.category &&
    existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  function submitRename() {
    setError(null);
    startTransition(async () => {
      const res = await renameCategory(cat.category, value);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setEditing(false);
    });
  }

  function submitDelete() {
    if (
      !confirm(
        `Delete "${cat.category}"? Its ${cat.txCount} transaction(s) will move to "Other".`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCategory(cat.category);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="h-8 max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setEditing(false);
                  setValue(cat.category);
                }
              }}
            />
            {willMerge && (
              <Badge variant="warning">Merges into {trimmed}</Badge>
            )}
            <Button size="sm" onClick={submitRename} disabled={pending || !trimmed}>
              <Check /> Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue(cat.category);
                setError(null);
              }}
              disabled={pending}
            >
              <X /> Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium">{cat.category}</span>
              {cat.hasBudget && <Badge variant="secondary">Budgeted</Badge>}
              {lockedFromRename && <Badge variant="outline">Locked</Badge>}
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular text-sm text-muted-foreground">
                {cat.txCount} tx
              </span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  disabled={lockedFromRename || pending}
                  aria-label={`Rename ${cat.category}`}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={submitDelete}
                  disabled={lockedFromDelete || pending}
                  aria-label={`Delete ${cat.category}`}
                >
                  <Trash2 className={lockedFromDelete ? "" : "text-negative"} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}

export function CategoryManager({ categories }: { categories: CategoryUsage[] }) {
  const names = categories.map((c) => c.category);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Add your own category, or rename one to fix its label everywhere — type an existing name to
        merge two together. Renaming or adding won&apos;t change how future imports auto-categorize
        unless you save a merchant rule.
      </p>
      <AddCategory existingNames={names} />
      <div className="divide-y divide-border">
        {categories.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          categories.map((cat) => (
            <CategoryRow key={cat.category} cat={cat} existingNames={names} />
          ))
        )}
      </div>
    </div>
  );
}
