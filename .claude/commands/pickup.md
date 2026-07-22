Begin work on an item from the work queue.

Usage: `/pickup "budget vs reality comparison"` (a phrase matching a work-queue item), or `/pickup` to be shown the queue first.

The work queue is the "Open Work Queue" section of [`/spec.md`](../../spec.md) — there is no Linear.

Workflow:
1. Find the matching item in `spec.md`'s Open Work Queue. If the argument is ambiguous or missing, list the `[UNTOUCHED]` items and ask which one.
2. Search `/handoff/` for prior session files that mention this work. If found, read the most recent.
3. Search `/specs/` for an existing spec covering it. If found, read it. If the item is non-trivial and there's no spec, recommend running `/specify` first.
4. Flip the item's status in `spec.md` to `[IN PROGRESS]` (this claims it).
5. Suggest a feature branch off `main`: `<type>/<short-description>` (`feat`/`fix`/`chore`/`docs`).
6. Summarize the situation — what the item asks for, what's already known, which files will likely be touched — and wait for direction before writing code.

Remember the verification baseline: before you later flip the item to `[COMPLETED]`, the app must boot on `http://127.0.0.1:5001`, all nav tabs must load 200, and the feature must work in the browser.
