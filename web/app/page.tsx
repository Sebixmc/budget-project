import Link from "next/link";
import { ArrowRight, ShieldCheck, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const features = [
  {
    icon: Upload,
    title: "Import any statement",
    body: "Upload Capital One or UCCU CSV exports. Re-imports are idempotent — no duplicates, ever.",
  },
  {
    icon: TrendingUp,
    title: "Understand your spending",
    body: "Categories, trends, and budgets that make where the money goes obvious at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Each person sees only their own data, enforced in the database with row-level security.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            L
          </span>
          Ledger
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <section className="flex flex-col items-start gap-6">
        <Badge variant="positive">Family Budget</Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Every dollar, accounted for.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          A calm, private place to track household spending across your bank accounts — now
          reachable from any device.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              Get started <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/login">See a demo</Link>
          </Button>
        </div>
      </section>

      {/* Design-system preview: a mock month summary. */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Spent</CardTitle>
          </CardHeader>
          <CardContent className="tabular text-2xl font-semibold text-negative">
            {formatCurrency(3128.44)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent className="tabular text-2xl font-semibold text-positive">
            {formatCurrency(5200.0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Net</CardTitle>
          </CardHeader>
          <CardContent className="tabular text-2xl font-semibold">
            +{formatCurrency(2071.56)}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="border-border/70">
            <CardHeader>
              <f.icon className="size-5 text-primary" />
              <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
          </Card>
        ))}
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-sm text-muted-foreground">
        Local-first heritage, now hosted securely. Your data is yours.
      </footer>
    </main>
  );
}
