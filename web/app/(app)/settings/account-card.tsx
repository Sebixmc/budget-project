"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BANK_FORMATS, type BankFormat } from "@/lib/parser";
import type { Account } from "@/lib/data/accounts";
import { deleteAccount, updateAccount } from "./actions";

export function AccountCard({ account, txCount }: { account: Account; txCount: number }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        {editing ? (
          <form action={updateAccount} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={account.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <Input name="name" defaultValue={account.name} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Owner</span>
              <Input name="owner" defaultValue={account.owner} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Bank format</span>
              <Select name="bank_format" defaultValue={account.bank_format}>
                {Object.entries(BANK_FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{account.name}</span>
                <Badge variant="secondary">{account.owner || "—"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {account.type} · {BANK_FORMATS[account.bank_format as BankFormat] ?? account.bank_format}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{txCount} transactions</p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit">
                <Pencil />
              </Button>
              <form
                action={deleteAccount}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `Delete "${account.name}"? Its ${txCount} transaction(s) will also be deleted.`,
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={account.id} />
                <Button size="icon" variant="ghost" type="submit" aria-label="Delete">
                  <Trash2 className="text-negative" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
