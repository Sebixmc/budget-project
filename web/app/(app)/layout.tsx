import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/app/nav";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border p-4 md:h-screen md:sticky md:top-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            L
          </span>
          Ledger
        </div>
        <Nav />
        <div className="mt-auto hidden flex-col gap-2 border-t border-border pt-4 md:flex">
          <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit" className="w-full justify-start">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-6 md:p-10">{children}</main>
    </div>
  );
}
