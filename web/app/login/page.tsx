"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PAGE_FALLBACK, isValidDefaultPage } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "signin" | "signup";

/** Map Supabase auth errors to friendlier copy. */
function friendlyError(raw: string, mode: Mode): string {
  if (/invalid login credentials/i.test(raw)) {
    return mode === "signin"
      ? "Wrong email or password."
      : "Could not create the account. Try again.";
  }
  if (/already registered/i.test(raw)) {
    return "That email already has an account — sign in instead.";
  }
  return raw;
}

/** Where to send the user after auth — their saved default page, or Dashboard.
 *  Reads their own user_settings row (RLS-scoped); any miss falls back safely. */
async function landingPage(supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await supabase.from("user_settings").select("default_page").maybeSingle();
    const page = (data as { default_page?: string } | null)?.default_page;
    if (page && isValidDefaultPage(page)) return page;
  } catch {
    // fall through
  }
  return DEFAULT_PAGE_FALLBACK;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "confirm-sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(await landingPage(supabase));
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          // Email confirmation is disabled → signed in immediately.
          router.push(await landingPage(supabase));
          router.refresh();
        } else {
          // Confirmation still enabled in Supabase; fall back gracefully.
          setStatus("confirm-sent");
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        friendlyError(err instanceof Error ? err.message : "Something went wrong. Try again.", mode),
      );
    }
  }

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setStatus("idle");
    setMessage("");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="mb-2 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              L
            </span>
            Ledger
          </Link>
          <CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Welcome back — enter your email and password."
              : "Pick a password of at least 8 characters."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "confirm-sent" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <MailCheck className="size-8 text-positive" />
              <p className="text-sm">
                Check <span className="font-medium">{email}</span> to confirm your account, then
                sign in.
              </p>
              <Button variant="ghost" size="sm" onClick={switchMode}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "working"}
              />
              <Input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === "working"}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={status === "working" || !email || !password}
              >
                {status === "working"
                  ? mode === "signin"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
              {status === "error" && <p className="text-sm text-negative">{message}</p>}
              <button
                type="button"
                onClick={switchMode}
                className="mt-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
