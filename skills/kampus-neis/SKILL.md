---
name: kampus-neis
description: Query official NEIS datasets through Kampus. Use when the task involves classes, majors, tracks, schedules, official timetables, classrooms, academies, key validation, or explaining official-limited versus official-full behavior.
---

# Kampus NEIS

Use raw CLI with `--json` or `--dry-run`. Prefer MCP only when a tool client is already active.

## Preferred Commands

```bash
kps neis classes --school "<school>" --region "<region>" --year 2026 --grade 3 --json
kps neis majors --school "<school>" --region "<region>" --json
kps neis tracks --school "<school>" --region "<region>" --json
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-31 --json
kps neis timetable --school "<school>" --region "<region>" --date 2026-03-12 --grade 3 --class-name 5 --json
kps neis classrooms --school "<school>" --region "<region>" --json
kps neis academies --office-code J10 --name "<keyword>" --json
kps neis classes --school "<school>" --region "<region>" --year 2026 --grade 3 --page-limit 2 --dry-run --format yaml
```

## Interpretation Rules

- `official-full` means a real key-backed official result.
- `official-limited` means NEIS sample-limited behavior may affect completeness.
- `NEIS_TIMETABLE_YEAR_LAG` usually indicates upstream freshness lag, not an immediate parser bug.
- `NEIS_STALE_CACHE` means the result succeeded in degraded cached mode.

## References

- `docs/CLI_REFERENCE.md`
- `docs/UPSTREAM_VERIFICATION.md`
- `docs/OPERATOR_RUNBOOK.md`
