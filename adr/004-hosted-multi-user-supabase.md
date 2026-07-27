# ADR-004: Hosted multi-user app on Vercel + Supabase (supersedes ADR-001)

**Status**: Accepted
**Date**: 2026-07-22
**Deciders**: Sebi
**Supersedes**: [ADR-001](001-local-only-no-cloud.md)

## Context

[ADR-001](001-local-only-no-cloud.md) made the app **local-only**: no cloud, no auth, `budget.db` on each person's machine, shared as code. That kept the security burden at zero, but it also means no cross-device access and no "we both see the same numbers" view. Sebi wants the app reachable from **any device** as a hosted website. That is a direct reversal of ADR-001's load-bearing rule, so it needs its own ADR rather than an incremental feature — this is that ADR.

The forces at play: (1) financial data is the single most sensitive thing this app holds, so hosting it raises the stakes of any authorization bug from "one machine" to "everyone's data"; (2) the household still wants it *simple* — no bank-credential storage, no operational sprawl; (3) the team wants a modern, polished UI and a deploy story that is boring and repeatable.

## Decision

Move to a **hosted, multi-user web app**:

- **Frontend + server:** Next.js (App Router, TypeScript) deployed on **Vercel**. Replaces the Flask + Jinja app.
- **Data + auth:** **Supabase** (managed Postgres + Auth + Storage). Replaces SQLite `budget.db`.
- **Authorization is enforced at the database with Row-Level Security (RLS).** Every table carries a `user_id` and has RLS policies (`user_id = auth.uid()`), so a user can only ever read or write their own rows — even if application code has a bug. This is the new load-bearing rule and replaces the old physical "separate file per machine" isolation.
- **Auth** is Supabase Auth (passwordless magic-link / OAuth), not a hand-rolled password system.
- **The Supabase `service_role` key never reaches the browser.** The browser gets only the public `anon` key, which is inert without a valid session because RLS gates every row. Admin/service keys live only in server-side environment variables (Vercel encrypted env vars), never committed.
- **We keep the CSV-upload model** (upload bank exports); we do **not** store bank login credentials and do **not** integrate Plaid. That keeps the highest-risk data surface out of the system entirely.
- **Domain invariants carry over unchanged:** amounts stored positive with direction in `flow`; `category = 'Transfer'` excluded from every money aggregation; additive migrations; idempotent CSV re-import via a uniqueness constraint; merchant rules beat keyword matching; manual categorizations are never overwritten. See the hard rules in the root [`CLAUDE.md`](../CLAUDE.md).

## Consequences

- **Positive:** Reachable from any device; both members can use it; managed Postgres gives real backups, migrations, and SQL; Vercel gives HTTPS, previews, and a boring deploy pipeline.
- **Positive:** RLS makes cross-user data leakage a database-enforced impossibility rather than an application concern — the strongest place to enforce it.
- **Negative / new burden:** We now hold multiple users' financial data on third-party infrastructure (Vercel + Supabase, both SOC 2). A misconfigured RLS policy or a leaked `service_role` key is now a real breach vector — so RLS-on-every-table and server-only secrets become non-negotiable, CI-checked invariants.
- **Negative:** The app is no longer offline; it depends on Supabase + Vercel availability and on the user trusting those providers. This is an explicit, accepted trade for multi-device access.
- **Constraint on future work:** New tables MUST ship with `user_id` + RLS in the same migration. Any code path that could return another user's row, or that moves the `service_role` key toward the client, contradicts this ADR.

## Alternatives Considered

- **Stay local-only (keep ADR-001):** rejected per the explicit product goal of any-device access. Kept as the fallback if hosting is ever deemed too risky.
- **Keep Flask, deploy as Vercel Python serverless functions + Supabase Postgres:** rejected — Flask/WSGI fights Vercel's serverless model (cold starts, session handling), Supabase Auth + RLS are smoothest from the JS/TS side, and it produces a weaker UI/design story than a native Next.js app. Reusing the Python was not worth the long-term friction.
- **Demo-only hosted instance with synthetic data (real data stays local):** rejected as the primary goal — it wouldn't give Sebi & Olivia real multi-device access to their own data. It remains a good option for a public showcase later.
- **Self-hosted Postgres / self-hosted Supabase:** deferred — more operational burden than a two-person tool warrants today. Managed Supabase is the pragmatic first step; nothing here forecloses self-hosting later.
