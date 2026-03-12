# Agent Guide

This guide is for coding agents, automation agents, and MCP clients that need to use or modify Kampus safely.

## 1. Choose the Right Surface

Use the narrowest surface that fits the task.

### MCP

Use MCP when:

- a tool-calling client is already active
- typed `structuredContent` is preferred
- the workflow is integration-heavy

### Raw CLI

Use raw CLI when:

- you need deterministic JSON output
- you are scripting or testing
- you are verifying current behavior
- you are debugging provider state

Preferred pattern:

```bash
kps <command> ... --json
```

### Human Shell

Use the human shell when:

- you are evaluating terminal UX
- you are validating guided setup, focus, layout, and visual feedback
- the task is explicitly about direct human usability

Do not use the human shell as the primary automation path.

## 2. School Identity Workflow

Use this workflow unless an active profile or default school already resolves the target.

1. `school search` or `school resolve`
2. confirm merged refs when results are ambiguous
3. run the target command
4. preserve warnings and completeness metadata in summaries

Key rule:

- school identity is not just the school name
- keep provider refs intact so downstream commands can route correctly

## 3. Provider Model

Kampus is intentionally split across two upstreams.

### Comcigan

Use for:

- student timetable
- teacher timetable
- teacher info
- next class
- class-time rails

Treat as:

- `unofficial`
- operationally useful but upstream-fragile

### NEIS

Use for:

- school info
- meals
- class info
- majors
- tracks
- schedules
- official timetables
- classrooms
- academies

Treat as:

- `official-full` with a valid key
- `official-limited` without a key when sample-mode truncation can happen

## 4. Metadata You Must Preserve

These fields are part of the product contract and should not be hidden or redefined:

- `dataStatus`
- `providerMetadata`
- `warnings`
- `accessMode`
- `complete`

Important warning semantics:

- `NEIS_TIMETABLE_YEAR_LAG`
  - official timetable data appears behind the current academic year
- `NEIS_STALE_CACHE`
  - official request failed and a cached official response was used
- `NEIS_PAGE_LIMIT`
  - result set exceeded configured pagination ceiling

## 5. Keyed vs Keyless Behavior

As of 2026-03-12:

- `KEY=SAMPLE` is not valid
- some NEIS endpoints still work without a key in limited sample mode

Interpretation rules:

- if a no-key response is marked `official-limited`, do not describe it as complete unless the metadata says it is complete
- if a keyed response is `official-full`, prefer it over unofficial data for overlapping official features

## 6. Config and Identity

User-configurable state:

- `NEIS_API_KEY`
- default school
- recent schools
- profiles
- cache policy

Read-only build metadata:

- project name
- project description
- repository URL
- homepage URL
- developer name
- developer contact

Do not move project or developer identity back into user config.

## 7. Verification Matrix

### Any meaningful code change

- `pnpm verify`

### Provider or upstream-facing change

- `pnpm smoke:live`
- `pnpm smoke:keyed` if a real key is available

### Packaging or release path change

- `pnpm smoke:pack:cli`

### Human shell or CLI UX change

- `pnpm --filter @kampus/cli test`
- `pnpm --filter @kampus/cli typecheck`

## 8. Documentation Routing

Use these docs deliberately instead of guessing.

- `README.md`
  - public product overview
- `docs/CLI_REFERENCE.md`
  - exact CLI shape
- `docs/OPERATOR_RUNBOOK.md`
  - operational smoke, release, key rotation
- `docs/TUI_HANDOFF.md`
  - human shell design boundaries
- `docs/UPSTREAM_VERIFICATION.md`
  - upstream facts and rejected approaches
- `docs/SKILLS_INDEX.md`
  - recipe and skill routing

## 9. Safe Defaults

- prefer raw CLI `--json` for verification
- prefer MCP for integrated tool clients
- prefer additive docs over changing established contracts
- prefer explicit warnings over “cleaner” but misleading output
