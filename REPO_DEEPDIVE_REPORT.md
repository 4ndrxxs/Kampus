---
title: Kampus Repository Deep-Dive Report
status: current
updated: 2026-03-12
category: repo-review
---

# Kampus Repository Deep-Dive Report

## 1. Purpose

This report captures the current repository state after the stabilization pass, with emphasis on architecture, packaging, verification, and what still counts as production risk.

## 2. Repository Shape

Primary packages:

- `@kampus/core`
  - shared types
  - config and cache helpers
  - provider routing
  - normalization and snapshot diff logic
- `@kampus/provider-comcigan`
  - unofficial timetable provider
- `@kampus/provider-neis`
  - official NEIS Open API provider
- `@kampus/cli`
  - end-user CLI surface
- `@kampus/mcp`
  - MCP server surface for agents and UIs

Primary documents:

- `README.md`
- `docs/CLI_REFERENCE.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/UPSTREAM_VERIFICATION.md`
- `docs/CODEX_AUDIT.md`
- `docs/CODEX_REBUILD_PLAN.md`
- `skills/kampus/SKILL.md`

## 3. Architecture Summary

### Core routing model

The most important architectural decision is that school identity is no longer a single overloaded code. It is a merged `providerRefs` object that can hold:

- Comcigan timetable identifiers
- NEIS office and school identifiers

That lets the client route by operation instead of by whichever provider happened to answer first.

### Provider split

Comcigan is used for:

- student timetable
- teacher timetable
- teacher info
- next class
- class times

NEIS is used for:

- school info
- meals
- official dataset queries
- school search augmentation

### Result model

The CLI JSON path and the MCP `structuredContent` path now share the same operational metadata:

- `dataStatus`
- `providerMetadata`
- provider warning codes

This is the main reason the CLI and MCP can stay in sync without inventing separate output models.

## 4. Product Surface

### CLI

Implemented command families:

- `auth`
- `config`
- `profile`
- `school`
- `class`
- `next`
- `class-times`
- `teacher`
- `meals`
- `neis`
- `export`
- `diff`
- `doctor`
- `debug`

The CLI also supports:

- saved key state
- saved default school
- active profiles
- multi-format structured output
- structured JSON failures

### MCP

Implemented MCP tools:

- `search_schools`
- `get_school_info`
- `get_student_timetable_today`
- `get_student_timetable_day`
- `get_student_timetable_week`
- `get_teacher_timetable`
- `get_teacher_info`
- `get_next_class`
- `get_class_times`
- `get_meals_today`
- `get_meals_week`
- `get_neis_dataset`
- `diff_timetable_snapshots`

## 5. Packaging and Release State

The repository now has a real release-oriented packaging path instead of relying on raw workspace publish behavior.

Current release shape:

- workspace build excludes `*.test.ts` from published runtime output
- package builds clean their own `dist` directories before recompiling
- CLI tarballs are produced through a dedicated staging script
- the staged CLI package bundles internal workspace code and does not declare internal workspace runtime dependencies
- packed CLI tarballs are install-smoke-tested in a clean temporary directory before release publish

That closes the earlier packaging problems where:

- test artifacts leaked into `dist`
- the public CLI depended on unpublished internal workspace packages

## 6. Verification Status

Verified locally on 2026-03-12:

- `pnpm lint`
- `pnpm verify`
- `pnpm smoke:live`
- `pnpm smoke:pack:cli`
- `pnpm smoke:keyed`

Verified behavior includes:

- no-key official NEIS limited mode
- full official NEIS mode with a real key
- saved config and profile flows
- multi-format output
- packed CLI install and startup
- official timetable lag warnings instead of hard failures

## 7. Remaining Advisory Risks

### Comcigan can still drift

This is the main unavoidable upstream risk. The code is better defended now, but the source remains unofficial.

### Non-Windows local secret storage still falls back to plain text

This is documented and signaled in diagnostics, but it is still a platform gap relative to Windows DPAPI storage.

### Contract coverage can still grow

Provider tests are strong, and CLI/MCP contract tests now exist, but broader snapshot coverage would still improve confidence for future changes.

## 8. Practical Current Judgment

Kampus is no longer in “prototype with clever parsing” territory.

It now has:

- explicit provider routing
- structured outputs
- local auth/config/profile state
- operational smoke checks
- release-oriented CLI packaging
- operator documentation

The remaining work is mostly about resilience and breadth, not about basic correctness or missing product shape.
