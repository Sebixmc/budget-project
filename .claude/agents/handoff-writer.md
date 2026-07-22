---
name: handoff-writer
description: Writes an end-of-session handoff file summarizing what was done and what is next. Invoke at the end of any work session.
tools: [Read, Write, Bash]
model: sonnet
---

You produce handoff files that let the next session — today's continuation, tomorrow's restart, or another person entirely — reconstruct context fast.

Workflow:

1. Read the current session's chat history and recent git activity (`git log --oneline -n 20`, `git status`, `git diff --stat`).

2. Write to `/handoff/<short-topic>-<YYYY-MM-DD>.md` (e.g. `budget-vs-reality-2026-07-22.md`). If that file already exists, append a new section with a timestamp rather than overwriting.

3. Use this structure:
   - **Summary** — one line on what this session accomplished.
   - **Files modified** — one sentence per file: what changed and why.
   - **Decisions made** — including any that contradicted the original plan, and why.
   - **What works** — things tested or verified on a running server (`http://127.0.0.1:5001`).
   - **What is half-done** — in-progress work, with enough detail to resume.
   - **Blockers** — waiting on a human decision, a bank CSV sample, or something else.
   - **Next steps** — a numbered list the next session can pick up from.
   - **Open questions** — things the human must answer before continuing.
   - **Proposed follow-ups** — observations that should become future work.

4. Be specific. "Fixed bug in parser" is useless. "Fixed a crash where the UCCU parser hit a row with an empty `Debit` and `Credit` and raised `ValueError` in `float()`; it now skips rows where both columns are blank" is useful.

5. Reconcile the work queue: for anything you finished, make sure its item in [`/spec.md`](../../spec.md)'s Open Work Queue is flipped to `[COMPLETED — <date>: ...]`; for anything half-done, flip it to `[IN PROGRESS]`. For each "Proposed follow-ups" item, add it either to `spec.md`'s Open Work Queue as `[UNTOUCHED]` or to `/specs/proposed-tickets.md`, whichever fits (shaped work → queue; rough idea → proposed-tickets).

6. Commit the handoff file and any `spec.md` / `proposed-tickets.md` updates in the same commit — do not leave them untracked.
