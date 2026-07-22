# /docs rules

Long-lived project knowledge: architecture, conventions, data flow.

Rules:

1. Docs describe how things **ARE**, not how they WERE or MIGHT BE. Decisions-in-progress or historical events belong in `/adr/` or `/handoff/`, not here.

2. Every doc has a **"Last reviewed: YYYY-MM-DD"** line at the top. Update it when you edit. Stale docs are worse than no docs — they mislead confidently.

3. Keep docs short — under a page. If a doc grows past that, split it. A reader (human or agent) should absorb one doc in under two minutes.

4. Cross-link related docs with relative paths so an agent can follow the trail.

5. **`/spec.md` is the master source of truth**, not `/docs/`. Docs here summarize and stabilize what `spec.md` describes in full — don't duplicate its data-model tables verbatim; link to them. If a doc and `spec.md` disagree, `spec.md` wins and you fix the doc.

6. If you create a new doc, add a one-line pointer to it in the "Knowledge base pointer" section of the root `/CLAUDE.md`. Otherwise it's invisible to agents that weren't told to look for it.
