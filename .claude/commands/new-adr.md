Record a durable architecture decision.

Usage: `/new-adr "Keep the app local-only instead of adding a shared server"`

Workflow:
1. Find the highest-numbered file in `/adr/` and use the next sequential number (zero-padded to 3 digits).
2. Copy `/adr/000-template.md` to `/adr/<NNN>-<kebab-title>.md`.
3. Fill in Status (`Proposed`), Date (today), Deciders, and draft the Context / Decision / Consequences / Alternatives Considered sections from the conversation.
4. Only write an ADR for a decision that is hard to reverse, spans multiple modules, or that a future dev might undo without understanding why (e.g. the local-only posture, the `bank_format` routing, the additive-migration rule). Small reversible choices go in `/docs/conventions.md` instead — if this is one, say so and don't create the ADR.
5. Summarize the draft and ask the human to review before committing. ADRs are immutable once merged.
