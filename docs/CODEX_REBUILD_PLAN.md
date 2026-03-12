# Kampus Stabilization Plan

Updated: 2026-03-12

This file is no longer a raw rebuild todo list. It now tracks what is already stabilized and what remains as the next production-hardening backlog.

## 1. Completed Stabilization Work

### Product and data model

- stable school identity with typed `providerRefs`
- merged school search and school resolve across Comcigan and NEIS
- operation-specific provider routing in `@kampus/core`
- no-key NEIS limited mode with explicit `accessMode`, `complete`, and warning metadata
- official timetable lag diagnostics for NEIS empty-result cases

### User-facing CLI and MCP surface

- `auth`, `profile`, `school`, `class`, `teacher`, `meals`, `neis`, `config`, `doctor`, `debug`, `export`, and `diff` command coverage
- structured CLI error payloads with stable exit codes
- shared metadata model across CLI JSON and MCP `structuredContent`
- multi-format output for structured CLI commands
- `neis --dry-run` planning output
- schedule ICS export

### Local config, auth, and storage

- saved `NEIS_API_KEY`
- default school
- recent schools
- active profiles
- cache policy
- Windows DPAPI-backed local key storage
- migration path from legacy plain-text config

### Reliability and operations

- dataset cache with stale-if-error fallback
- doctor and debug diagnostics
- keyed smoke and no-key smoke
- scheduled live smoke workflow with issue-open and issue-close automation
- release workflow
- release CLI pack pipeline with clean-install smoke
- operator runbook

### Validation

- provider regression tests
- config and client tests
- CLI contract tests
- MCP contract tests
- `pnpm verify`
- `pnpm smoke:live`
- `pnpm smoke:pack:cli`
- `pnpm smoke:keyed`

## 2. Current Production Backlog

### P1: strengthen interfaces and contracts

- expand CLI snapshot coverage across more commands and formats
- expand MCP tool-level contract tests beyond the current baseline
- document or version the JSON output envelope for long-lived external consumers

### P2: strengthen platform support

- improve non-Windows local secret handling or clearly document env-only guidance there
- add more platform-specific validation once real release consumers are known

### P3: deepen provider and upstream resilience

- capture more provider fixtures when Comcigan or NEIS payloads shift
- keep `docs/UPSTREAM_VERIFICATION.md` current whenever parser logic changes
- consider broader operator alert routing beyond GitHub issue creation

## 3. Non-Negotiable Guardrails

- do not import third-party static school databases
- do not reintroduce old HTML scraping paths as production NEIS sources
- do not change Comcigan or NEIS parser logic without direct live re-verification
- do not hide limited or truncated official results from the caller
