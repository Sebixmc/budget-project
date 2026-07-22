Show the open work queue — what's ready to pick up. Read-only.

Usage: `/todo`

This project has no Linear or external tracker. The work queue is the **"Open Work Queue"** section of [`/spec.md`](../../spec.md).

Workflow:
1. Read the "Open Work Queue" section of `spec.md`.
2. Collect every item and its status tag (`[UNTOUCHED]` / `[IN PROGRESS]` / `[BLOCKED: reason]`). Skip `[COMPLETED]` items.
3. Split into **Ready now** (`[UNTOUCHED]`) and **In flight / blocked** (`[IN PROGRESS]` or `[BLOCKED]`).
4. Render two short markdown tables:
   - Ready now: `Priority · Item · Notes` (Priority = the High/Medium/Low section it's under).
   - In flight / blocked: `Status · Item · Reason` (surface the blocker reason for blocked items).
5. Sort Ready now by priority (High first).
6. Recommend ONE highest-leverage pickup in one sentence (usually the top High-priority `[UNTOUCHED]` item).
7. If nothing is `[UNTOUCHED]`, say so and point at any abandoned `[IN PROGRESS]` items worth resuming (check `git log` to confirm they're stale).

Do NOT change any status — that's `/pickup`'s job.
