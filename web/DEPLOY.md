# Deploying Ledger (Vercel + Supabase)

Step-by-step to take the hosted app from repo to live. See
[ADR-004](../adr/004-hosted-multi-user-supabase.md) for the why and the security model.

You need a browser **once** (a phone browser is fine) to create the Supabase project
and import into Vercel. Everything else is copy/paste.

---

## Phase 1 — Supabase (database + auth)

1. **Create the project** — [supabase.com](https://supabase.com) → **New project**. Choose a
   region near you and set a database password (save it; you rarely need it).

2. **Copy your keys** — Project → **Settings → API**:
   | You need | Label (naming varies by project age) |
   |---|---|
   | Project URL | "Project URL" |
   | Public key | "anon" / "publishable" key |
   | Secret key | "service_role" / "secret" key — **keep private** |

3. **Create the schema + RLS** — **SQL Editor → New query**, paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and **Run**.
   This creates every table, enables Row-Level Security with per-user policies, and installs
   the trigger that seeds your four default accounts on first sign-in. Expect "Success".

4. **Configure auth** — **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` for now (add the Vercel URL after Phase 3).
   - **Redirect URLs** (allow-list), add both:
     - `http://localhost:3000/**`
     - `https://*.vercel.app/**` (tighten to your real domain later)
   - Email provider is on by default → magic links work immediately. Supabase's built-in email
     is rate-limited; add custom SMTP later for volume.

---

## Phase 2 — Verify locally (recommended before deploying)

```bash
cd web
cp .env.example .env.local
# fill in the three values:
#   NEXT_PUBLIC_SUPABASE_URL       = Project URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY  = anon / publishable key
#   SUPABASE_SERVICE_ROLE_KEY      = service_role / secret key
npm install
npm run dev            # http://localhost:3000
```

Sign in with your email → open the magic link → you should land on the dashboard with four
seeded accounts. Try an Upload with a real CSV.

---

## Phase 3 — Vercel (hosting)

1. **Import** — [vercel.com](https://vercel.com) → **Add New → Project** → import
   `Sebixmc/budget-project`.
2. **⚠️ Set Root Directory = `web`.** The app is in a subfolder; miss this and the build fails.
   Framework auto-detects **Next.js**.
3. **Environment Variables** — add the same three as local. Critical:
   `SUPABASE_SERVICE_ROLE_KEY` must **not** be prefixed `NEXT_PUBLIC_` and should be marked
   sensitive — it bypasses RLS and must never reach the browser (CLAUDE.md hard rule #2).
4. **Deploy.** HTTPS is automatic.
5. **Close the auth loop** — copy your `https://<app>.vercel.app` URL, then in
   **Supabase → Auth → URL Configuration** set it as the Site URL and add
   `https://<app>.vercel.app/**` to the redirect allow-list.

---

## Environment variables (reference)

| Name | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon/publishable key; inert without a session (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only secret** | never `NEXT_PUBLIC_`, never in the client bundle |

## Notes

- **Node 22+** — Vercel's default runtime; matches `@supabase/supabase-js` engines.
- **Migrations** are forward-only SQL in `supabase/migrations/`. Run new files in the SQL Editor
  (or via the Supabase CLI: `supabase db push`). Never edit an applied migration.
- **Vercel builds `main`.** Merge the PR stack (bottom-up) before `main` has the app, or point
  Vercel at the top branch for a preview deploy.
