import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data/accounts";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "./upload-form";

type UploadRow = {
  id: string;
  filename: string;
  rows_imported: number;
  rows_skipped: number;
  created_at: string;
  accounts: { name: string } | null;
};

export default async function UploadPage() {
  const accounts = await getAccounts();
  const supabase = await createClient();
  const { data } = await supabase
    .from("uploads")
    .select("id, filename, rows_imported, rows_skipped, created_at, accounts(name)")
    .order("created_at", { ascending: false })
    .limit(20);
  const history = (data ?? []) as unknown as UploadRow[];

  return (
    <div>
      <PageHeader title="Upload" description="Import a bank statement CSV to add transactions." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Import a statement</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadForm accounts={accounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Capital One:</span> Account → Download
              transactions → CSV. Credit cards use the Savor format; 360 checking/savings use the
              bank format.
            </p>
            <p>
              <span className="font-medium text-foreground">UCCU:</span> Account History → Export →
              CSV. Only <span className="font-medium text-foreground">Posted</span> rows are
              imported.
            </p>
            <p>Re-uploading the same file is safe — duplicates are skipped, never doubled.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent imports</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">File</th>
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 text-right font-medium">Imported</th>
                    <th className="py-2 text-right font-medium">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4">{u.filename || "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{u.accounts?.name ?? "—"}</td>
                      <td className="tabular py-2 pr-4 text-right text-positive">
                        {u.rows_imported}
                      </td>
                      <td className="tabular py-2 text-right text-muted-foreground">
                        {u.rows_skipped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
