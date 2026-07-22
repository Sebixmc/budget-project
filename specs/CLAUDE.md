# /specs rules

Per-feature specs, one file per non-trivial feature, named `<short-name>.md`.

Rules:

1. Specs are written **before** implementation, for anything larger than a one-file change. Summarize the spec back to the human and get a nod before coding.

2. Use the structure in `/specs/TEMPLATE.md` (and `/.claude/agents/spec-writer.md`). Do not invent a different structure. Acceptance criteria use **EARS notation** (`WHEN <trigger>, the system SHALL <response>`).

3. Tie each spec back to its item in the "Open Work Queue" of [`/spec.md`](../spec.md) — the spec is the detail; `spec.md`'s status tag is the state.

4. Don't casually rewrite a spec after it's implemented. If scope changes mid-implementation, append a section titled `Amendment <date>` explaining what changed and why.

5. When a feature ships, do **not** delete its spec. It's the durable record of what was built and why.

6. Honor the hard rules from the root `/CLAUDE.md` (local-only, transfers excluded, positive amounts + `flow`, additive migrations, idempotent uploads). A spec that violates one needs an ADR first, not a spec.

7. `/specs/proposed-tickets.md` is NOT a per-feature spec — it's a loose backlog with its own rules in its header. The rules above don't apply to it.
