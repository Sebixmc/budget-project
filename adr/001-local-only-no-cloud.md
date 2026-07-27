# ADR-001: Local-only, no auth, share-the-code

> **Superseded by [ADR-004](004-hosted-multi-user-supabase.md)** (2026-07-22). The app moved to a hosted, multi-user model on Vercel + Supabase with database-enforced Row-Level Security. This record is kept for history; the local-only rule below no longer governs the project.

**Status**: Superseded by ADR-004
**Date**: 2026-05-07
**Deciders**: Sebi

## Context

The app holds real, sensitive financial data for a household — bank transactions across Capital One and UCCU accounts. Two people want to use it. The obvious design is a hosted app with logins so each person signs in and sees their own data. But that means holding multiple people's financial data on a server, running an auth system, and taking on the security and operational burden that comes with both. For a two-person family tool, that cost is wildly out of proportion to the benefit, and a breach would expose exactly the data users most want kept private.

## Decision

The app is **local-only**. It binds to `127.0.0.1:5001`, has no login and no shared server, and stores everything in a SQLite `budget.db` on the user's own machine. It is shared **as code**: anyone clones the repo and runs their own isolated instance against their own database. No financial data — transactions, account details, `budget.db`, or raw CSV exports — ever leaves the device or gets committed to git. This is promoted to hard rule #1 in the root `CLAUDE.md`.

## Consequences

- **Positive:** No auth to build or maintain; no server to secure or pay for; total data isolation between people; a breach of one machine can't touch anyone else's data. The app is simple and fully offline.
- **Positive:** `.gitignore` excludes `*.db`, `*.csv`, and `uploads/`, so sharing the code never leaks data.
- **Negative:** No cross-device sync — your data lives on one machine; backup is "copy `budget.db` somewhere safe."
- **Negative:** No "we both see the same numbers" view without a future, deliberate decision.
- **Constraint on future work:** Adding any cloud sync, hosted deployment, telemetry, or third-party data connection (e.g. Plaid) contradicts this ADR and requires a new ADR that supersedes it — not an incremental feature.

## Alternatives Considered

- **Hosted multi-user app with login (Supabase/Postgres + auth):** rejected — it centralizes multiple users' financial data, adds an auth/security burden, and creates password-and-account-management friction for a two-person tool.
- **Shared LAN instance (bind `0.0.0.0`) with light auth:** deferred to a future decision (it's in the work queue as low-priority). Still local to the home, but needs a minimal auth mechanism before it's safe to expose, so it stays out of scope for now.
