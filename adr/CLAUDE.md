# /adr rules

This folder holds Architecture Decision Records — one file per major decision, numbered sequentially: `001-local-only-no-cloud.md`, `002-…`.

Rules:

1. Use the template at `/adr/000-template.md`. Do not deviate from its section structure (Context, Decision, Consequences, Alternatives Considered).

2. **ADRs are immutable.** Once merged, do not edit an ADR. If a decision changes, write a NEW ADR that supersedes the old one, and add a `Superseded by ADR-NNN` line at the top of the old one.

3. ADRs are short — one page is the target. If you can't explain a decision in one page, it isn't clear enough to record yet.

4. Only write an ADR for a decision that is **hard to reverse**, **spans multiple modules**, or that a future developer might undo without understanding the reasoning. Small reversible choices go in `/docs/conventions.md`, not here.

5. The `/spec.md` "Decisions Log" is the informal running record; promote a decision here when it becomes load-bearing (something a future change could break without realizing). ADRs 001–003 were seeded that way.
