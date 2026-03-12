---
name: kampus
description: Route work across Kampus features and interfaces. Use when the task involves Korean school lookup, timetables, meals, official NEIS datasets, diagnostics, profiles, auth, MCP usage, or Kampus product changes and you need the right specialized Kampus workflow.
---

# Kampus

Start here for any Kampus task, then route into the narrower repo-local skill that matches the job.

## Decision Rule

1. Prefer Kampus MCP tools when an MCP client is already active.
2. Otherwise prefer raw CLI with `--json` for automation and verification.
3. Use the human shell only for direct terminal UX work.
4. Resolve school identity before deeper operations unless a saved default school or active profile already covers it.
5. Preserve `dataStatus`, `providerMetadata`, `warnings`, `accessMode`, and `complete`.

## Skill Routing

- school search, resolve, school info
  - `skills/kampus-school/SKILL.md`
- student timetable, teacher timetable, next class, class times
  - `skills/kampus-timetable/SKILL.md`
- meals and meal interpretation
  - `skills/kampus-meals/SKILL.md`
- official NEIS datasets and key/full-vs-limited behavior
  - `skills/kampus-neis/SKILL.md`
- verification, smoke, release, diagnostics
  - `skills/kampus-ops/SKILL.md`

## Base Workflow

1. identify the target surface: MCP, raw CLI, or human shell
2. resolve school identity if needed
3. run the smallest relevant query
4. include warnings and completeness notes in the result
5. run the appropriate verification path if code or behavior changed

## Important Notes

- `official-full` means key-backed official NEIS data
- `official-limited` means no-key or sample-limited official NEIS behavior
- `unofficial` means Comcigan-backed or non-official upstream data
- do not call blank occupied periods free time
- do not reintroduce mutable app identity into user config

## References

- `AGENTS.md`
- `docs/AGENT_GUIDE.md`
- `docs/SKILLS_INDEX.md`
- `docs/CLI_REFERENCE.md`
