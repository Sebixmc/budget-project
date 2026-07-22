# /handoff rules

Session continuity files, one per work session, named `<short-topic>-<YYYY-MM-DD>.md`.

Rules:

1. Write a handoff at the end of any non-trivial session (use `/handoff`, which dispatches the `handoff-writer` subagent). It captures: summary, files modified, decisions, what works, what's half-done, blockers, next steps, open questions, and proposed follow-ups.

2. Handoffs are **append-only per file**: if a file for today's topic already exists, add a timestamped section rather than overwriting.

3. Be specific enough that a fresh session (or a different person) can resume without re-reading the whole codebase. Vague summaries defeat the purpose.

4. Commit the handoff — never leave it untracked. Reconcile `spec.md`'s Open Work Queue in the same commit (finished → `[COMPLETED]`, half-done → `[IN PROGRESS]`), and mirror any rough follow-ups into `/specs/proposed-tickets.md`.

5. Handoffs are a running log, not permanent docs. Durable "how it works" knowledge belongs in `/docs/`; durable decisions belong in `/adr/`; the current picture and work queue belong in `/spec.md`. It's fine for old handoffs to become historical — don't prune them, they're the session trail.
