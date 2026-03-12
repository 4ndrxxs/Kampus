# Kampus Current Audit

Updated: 2026-03-12

## Scope

Inspected:

- root workspace manifests and TypeScript config
- `packages/core`
- `packages/providers/comcigan`
- `packages/providers/neis`
- `packages/cli`
- `packages/mcp`
- `skills/kampus`
- `docs/`

Validation run during this audit:

- `pnpm verify`: passes
- `pnpm smoke:pack:cli`: passes
- `pnpm smoke:keyed`: passes
- CLI smoke checks:
  - auth status and export
  - profile save, show, and active-profile default flow
  - school search
  - school search table output
  - school info in no-key NEIS limited mode
  - meals today, week, and month in no-key NEIS limited mode
  - NEIS dry-run YAML output
  - NEIS schedule JSON and ICS output
  - default school flow through saved config
  - doctor and debug commands
  - structured JSON failure output

## Executive Judgment

Kampus is no longer a prototype skeleton. The repository now has a stable normalized core model, operation-specific provider routing, local config support, structured MCP outputs, and meaningful tests around the most fragile provider logic.

It is materially closer to a production CLI now. The main remaining gaps are upstream fragility, no-key NEIS truncation, non-Windows plain-text fallback for local secrets, and the need for broader contract coverage plus alerting guidance.

## What Is Strong

- Core school identity is explicit through `providerRefs` instead of an overloaded generic school code.
- Provider orchestration is operation-specific instead of provider-order driven.
- Comcigan and NEIS are both active in school search and resolution.
- NEIS responses now expose `official-full` vs `official-limited` access state.
- Local config supports a saved NEIS key, default school, recent schools, cache policy, and saved profiles.
- Windows local config now upgrades saved NEIS keys into DPAPI-backed protected storage.
- CLI has dedicated `auth` and `profile` command groups.
- CLI JSON output and MCP structured output now surface the same status metadata.
- CLI supports `json`, `markdown`, `yaml`, `csv`, `table`, and `ndjson` output paths for structured commands.
- CLI now returns structured JSON errors when `--json` is set.
- CLI includes first-pass operator diagnostics through `doctor` and `debug`.
- NEIS dataset queries now support dry-run planning and configurable page limits.
- NEIS dataset caching now supports stale-if-error fallback with an explicit warning.
- Keyed smoke coverage exists both locally and in CI workflows.
- Scheduled live smoke now uploads artifacts, writes workflow summaries, and manages GitHub issue alerts for failures and recovery.
- Operator deployment and incident guidance now exists in `docs/OPERATOR_RUNBOOK.md`.
- Parser and config behavior are protected by tests.

## What Is Working

- merged school search and resolve
- Comcigan student timetable
- Comcigan teacher timetable and teacher info
- next class and class-time lookup
- official NEIS school info
- official NEIS meals for day, week, range, and month
- official NEIS dataset queries for classes, majors, tracks, schedules, official timetables, classrooms, and academy info
- schedule ICS export
- timetable export and snapshot diff
- root verification, live smoke, and keyed smoke scripts
- release packaging workflow for the CLI tarball
- release CLI tarball packaging with clean-install smoke validation
- detailed CLI reference in `docs/CLI_REFERENCE.md`

## What Still Needs Attention

### 1. Upstream risk remains real

Comcigan is unofficial. Even with direct verification and parser tests, it can still break without notice.

### 2. No-key NEIS mode is useful but not complete

When `KEY` is omitted, some official endpoints still answer in sample mode. Kampus now exposes that state explicitly, but callers still need to treat those responses as potentially truncated.

### 3. Full-mode NEIS smoke depends on key hygiene

This is now covered locally and in CI, but it still depends on keeping a valid `NEIS_API_KEY` secret configured wherever the smoke runs.

### 4. CLI and MCP contract tests are still thinner than provider tests

Core logic and provider parsing are still covered more deeply than interface contracts, but Kampus now has baseline CLI and MCP contract tests. The next production step is expanding those into broader output snapshots and failure-path coverage.

### 5. Operational hardening still has one layer left

This repository now has scheduled live smoke, release workflows, an operator runbook, and Windows-protected local key storage. The next layer is alert routing and broader contract snapshots.

## Recommended Next Pass

1. Expand CLI contract snapshots across the new `auth`, `profile`, and multi-format output paths.
2. Consider stronger secret storage for non-Windows environments or document env-only guidance there.
3. Add alert routing or notification guidance for scheduled smoke failures.
4. Keep `docs/UPSTREAM_VERIFICATION.md` current whenever provider logic changes.
