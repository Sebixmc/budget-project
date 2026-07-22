# Ledger — hosted Family Budget app (`web/`)

Next.js (App Router, TypeScript) + Supabase (Postgres + Auth), deployed on Vercel.
This is the hosted rewrite of the local-only Flask app at the repo root — see
[ADR-004](../adr/004-hosted-multi-user-supabase.md) and [`../specs/hosted-rewrite.md`](../specs/hosted-rewrite.md).

## Local development

```bash
cd web
cp .env.example .env.local        # fill in your Supabase project values
npm install
npm run dev                       # http://127.0.0.1:3000
```

`.env.local` needs:

| Var | Where it's used | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (RLS gates data) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only (`lib/supabase/admin.ts`) | **no — secret** |

## Checks (must be green before merge)

```bash
npm run lint
npm run typecheck
npm test          # Vitest
npm run build
```

## Deploying to Vercel

1. Import the GitHub repo into Vercel. Set **Root Directory = `web`** (this app is a subfolder).
2. Framework preset: **Next.js** (auto-detected).
3. Add Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. Mark the service-role key as **not** exposed to the browser — it must
   never be a `NEXT_PUBLIC_*` var (CLAUDE.md hard rule #2).
4. Deploy. HTTPS is automatic.

## Layout

```
web/
  app/                 routes (App Router)
  components/ui/        design-system primitives (button, card, badge, …)
  lib/
    utils.ts            cn() + formatCurrency()
    env.ts              public/server env access
    supabase/           client.ts (browser) · server.ts (SSR) · admin.ts (service-role, server-only)
  supabase/migrations/  Postgres schema + RLS (added in PR3)
```
