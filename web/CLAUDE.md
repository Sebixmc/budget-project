# /web rules — the hosted Next.js + Supabase app

This is the hosted app (Next.js App Router + TypeScript on Vercel, Supabase for data/auth). It is replacing the legacy Flask app at the repo root — see [ADR-004](../adr/004-hosted-multi-user-supabase.md) and [`../specs/hosted-rewrite.md`](../specs/hosted-rewrite.md). Read the root [`../CLAUDE.md`](../CLAUDE.md) hard rules first; the ones below are `web/`-specific.

## Security (load-bearing)

1. **Every table has `user_id` + RLS.** Never add a table or query that could return another user's rows. New tables ship their RLS policies in the same migration.
2. **The `service_role` key is server-only.** It lives in `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) and is used only via `lib/supabase/admin.ts`, which starts with `import "server-only"`. Never import `admin.ts` from a client component. The browser gets only the anon key (`lib/supabase/client.ts`).
3. **Read the user's session server-side** via `lib/supabase/server.ts` for data access, so queries run as the user and RLS applies. Client-side reads use `lib/supabase/client.ts`.
4. **No financial data in the repo or CI.** Fixtures are synthetic. `.env*` (except `.env.example`) is gitignored.

## Design system

- All UI is built from tokens + primitives, not ad-hoc styles. Colors/spacing/radius/shadow tokens live in `app/globals.css` (`@theme`); never hard-code a hex — use a token (`bg-card`, `text-muted-foreground`, `text-positive`/`text-negative`, ...).
- Reusable primitives live in `components/ui/` (`button`, `card`, `badge`, ...). Compose these; add a new primitive here rather than one-off styling a page.
- Money is shown with `formatCurrency()` and the `.tabular` class (tabular figures). Amounts are stored positive; direction comes from `flow` (hard rule #4).

## Domain invariants (carried from the app)

- Exclude `category = 'Transfer'` from every money total/average/chart.
- CSV re-import is idempotent via `UNIQUE(user_id, account_id, date, description, amount, flow)`.
- Merchant rules beat keyword matching; never overwrite `category_source = 'manual'`.
- Keep `lib/parser.ts` and `lib/categorizer.ts` pure (no Supabase/Next imports) so they unit-test directly.

## Tooling

- Before claiming done: `npm run lint && npm run typecheck && npm test && npm run build` all green.
- Tests are Vitest (`*.test.ts`), colocated in `lib/` / `app/`. Pure logic (parser/categorizer) is the priority.
- Migrations are forward-only SQL in `supabase/migrations/` — never edit an applied migration.
