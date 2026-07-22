import Link from "next/link";
import { Landmark, Upload } from "lucide-react";
import { getAccounts } from "@/lib/data/accounts";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BANK_FORMATS, type BankFormat } from "@/lib/parser";

export default async function DashboardPage() {
  const accounts = await getAccounts();

  return (
    <div>
      <PageHeader title="Dashboard" description="Your accounts at a glance.">
        <Button asChild size="sm">
          <Link href="/upload">
            <Upload /> Import statement
          </Link>
        </Button>
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="size-4 text-primary" />
                {a.name}
              </CardTitle>
              <Badge variant="secondary">{a.owner || "—"}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {a.type} · {BANK_FORMATS[a.bank_format as BankFormat] ?? a.bank_format}
            </CardContent>
          </Card>
        ))}
      </section>

      {accounts.length === 0 && (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-muted-foreground">
            No accounts yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
