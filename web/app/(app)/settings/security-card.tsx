"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SecurityCard({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords don't match.");
      return;
    }
    setStatus("working");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("done");
      setMessage("Password updated.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <Input value={email} disabled readOnly />
        <span className="text-xs text-muted-foreground">
          Your email is your sign-in and can&apos;t be changed here.
        </span>
      </label>

      <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">New password</span>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={status === "working"}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Confirm new password</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={status === "working"}
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={status === "working" || !password || !confirm}>
            {status === "working" ? "Updating…" : "Update password"}
          </Button>
          {message && (
            <span className={status === "error" ? "text-sm text-negative" : "text-sm text-positive"}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
