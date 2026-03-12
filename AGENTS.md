# Kampus Agent Instructions

Use this repository as a productized school-information toolkit, not as an ad hoc scraper collection.

## Read First

Before making meaningful changes, read these in order:

1. `README.md`
2. `docs/AGENT_GUIDE.md`
3. `docs/CLI_REFERENCE.md`
4. `docs/UPSTREAM_VERIFICATION.md`
5. `docs/OPERATOR_RUNBOOK.md`

Read these when relevant:

- `docs/TUI_HANDOFF.md` for human-shell work
- `docs/SKILLS_INDEX.md` for agent workflows and recipe routing
- `REPO_DEEPDIVE_REPORT.md` for architecture changes

## Product Boundaries

- Preserve all existing raw CLI commands unless the task explicitly changes the public contract.
- Preserve MCP tool semantics unless the task explicitly changes the MCP contract.
- Preserve `dataStatus`, `providerMetadata`, `warnings`, `accessMode`, and `complete`.
- Preserve the provider split:
  - Comcigan for practical timetable workflows
  - NEIS for official datasets, school info, meals, and diagnostics
- Treat project and developer metadata as read-only build metadata.
- Do not add user-editable project/developer identity back into config.

## Preferred Surface

- Use MCP when an MCP client is already active and structured tool calls are the natural path.
- Use raw CLI with `--json` for automation, tests, scripted verification, and agent workflows.
- Use the human shell only for direct user-facing terminal UX work.

## School Identity Rules

- Resolve school identity before deeper operations unless an active profile or default school already covers it.
- Keep merged provider refs intact.
- Do not add external static school databases from third-party repos.
- Do not import copied datasets unless licensing and provenance are explicitly safe.

## Warning Interpretation

- `official-full`
  - authoritative official result with a real key
- `official-limited`
  - official NEIS response in sample-limited mode; completeness may be reduced
- `unofficial`
  - Comcigan or other unofficial path
- `NEIS_TIMETABLE_YEAR_LAG`
  - upstream freshness problem, not automatically a parser bug
- `NEIS_STALE_CACHE`
  - successful degraded response using cached official data

## Verification

Run the smallest relevant set, then the broader set before handing off:

- `pnpm verify`
- `pnpm smoke:live`
- `pnpm smoke:keyed` when a real `NEIS_API_KEY` is available
- `pnpm smoke:pack:cli` for packaging/release changes

When changing TUI-only behavior, at minimum also run:

- `pnpm --filter @kampus/cli test`
- `pnpm --filter @kampus/cli typecheck`

## Skills

Repository-local skill docs live under `skills/`.

Start with:

- `skills/kampus/SKILL.md`

Then route into:

- `skills/kampus-school/SKILL.md`
- `skills/kampus-timetable/SKILL.md`
- `skills/kampus-meals/SKILL.md`
- `skills/kampus-neis/SKILL.md`
- `skills/kampus-ops/SKILL.md`

## Do Not Regress

- Do not hide warning metadata to make output look cleaner.
- Do not downgrade human-shell improvements by routing everything through subprocess calls.
- Do not reintroduce mutable app identity via config.
- Do not describe occupied blank timetable periods as free time.
