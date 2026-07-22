Write an end-of-session handoff.

Usage: `/handoff` (auto-picks a topic from the branch/recent work) or `/handoff "budget vs reality"` (explicit topic).

Dispatch to the `handoff-writer` subagent, passing the topic and today's date. The result is a handoff file at `/handoff/<short-topic>-<YYYY-MM-DD>.md`, the Open Work Queue in [`/spec.md`](../../spec.md) reconciled (finished items → `[COMPLETED]`, half-done → `[IN PROGRESS]`), any rough follow-ups appended to `/specs/proposed-tickets.md`, and a git commit adding all of it.
