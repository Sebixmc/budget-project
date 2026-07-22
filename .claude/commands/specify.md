Write the spec for a work-queue item before implementation.

Usage: `/specify "manual transaction entry"` (a phrase matching a work-queue item).

Dispatch to the `spec-writer` subagent with the item description as its argument. The result is a spec file at `/specs/<short-name>.md` following the structure in [`/specs/TEMPLATE.md`](../../specs/TEMPLATE.md), with acceptance criteria in EARS notation. Do not begin implementation until the human has reviewed the spec.
