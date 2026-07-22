import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder shell. Supabase Auth (magic-link) is wired up in PR3
// (feat/supabase-schema-rls). This page exists so navigation resolves and to
// preview the auth surface in the design system.
export default function LoginPage() {
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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            We&apos;ll email you a magic link — no password to remember.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            disabled
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <Button disabled className="w-full">
            Email me a link
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Authentication is enabled in the next release.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
