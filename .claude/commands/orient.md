Orient yourself in this repo before doing any work. This is the first thing to run in a fresh session on this project.

Workflow:
1. **Sync first.** Run `git fetch origin && git status -sb`. Multiple agents push to this repo continuously — a clone goes stale within the hour. If you are behind, `git pull --ff-only` before reading anything else, or you will orient to a stale tree.
2. Read `/CLAUDE.md` fully.
3. Read [`/spec.md`](../../spec.md) — the master source of truth for what the app does, its data model, and the Open Work Queue.
4. Read [`/adr/004-hosted-multi-user-supabase.md`](../../adr/004-hosted-multi-user-supabase.md) — the hosted pivot. It **supersedes** ADR-001 (local-only) and changes the load-bearing rule. Do not skip it; the older docs still contain local-only language.
5. List the folders that have their own `CLAUDE.md` (`web/`, `templates/`, `docs/`, `specs/`, `adr/`, `handoff/`, `.github/`) and note you'll read each before writing there.
6. Read `/docs/architecture.md` and `/docs/conventions.md`.
7. Read the most recent file in `/handoff/` (if any) to see where the last session left off.
8. Confirm the toolchain for the area you'll touch:
   - **`web/` (the live app, Next.js + Supabase):** from `web/` — `npm run dev` boots `http://localhost:3000`; `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run build`. Needs `web/.env.local` with the Supabase URL + anon key, or every route 500s in middleware.
   - **Repo root (legacy Flask, reference only — do not add features):** `bash start.sh` or `python3 app.py` boots `http://127.0.0.1:5001`; `ruff check .` + `ruff format --check .`; `pytest -q`.
9. Summarize back to the human, in under 10 lines: the product in one sentence, the stack (**hosted Next.js + Supabase on Vercel**, with the Flask app at the root as the legacy parity reference being ported out), the load-bearing rule (**a user's data is visible only to that user, enforced by Postgres RLS — `user_id = auth.uid()` on every table; the `service_role` key is server-only**), and the top `[UNTOUCHED]` items in `spec.md`'s Open Work Queue. Then ask what to work on (or suggest running `/todo`).

Known environment gotchas worth stating up front if they apply to your task:
- Agent devcontainers have historically firewalled `*.supabase.co` and PyPI, so **authenticated pages cannot be exercised in a browser from a sandboxed session**. Work can ship unit-tested and CI-green while never having been verified signed-in. If your task needs a real browser pass, say so rather than marking it `[COMPLETED]`.
- Auth is **email + password with email confirmation off** (as of 2026-08-04). Magic links were tried and removed. The "Confirm email" toggle is a hosted-Supabase dashboard setting — `web/supabase/config.toml` only governs a local CLI stack.

Do not write code during `/orient`. It is read-only orientation.
