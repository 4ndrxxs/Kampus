# Agent Recipes

These recipes are compact, repeatable Kampus workflows for agents and scripted operator tasks.

## 1. School Onboarding

Goal:

- identify a school
- save it as default
- create an active profile

Steps:

```bash
kps school search "<keyword>" --json
kps school resolve "<school>" --region "<region>" --json
kps config set default-school "<school>" --region "<region>"
kps profile save default --school "<school>" --region "<region>" --grade 3 --class 5 --activate --json
```

## 2. Daily Student Brief

Goal:

- get today or weekly class context for a student

Steps:

```bash
kps class today --json
kps next --json
kps meals today --date 2026-03-12 --json
```

If a default school and active profile are not already configured, resolve school identity first.

## 3. Teacher Snapshot

Goal:

- inspect a teacher's weekly context

Steps:

```bash
kps teacher info --school "<school>" --region "<region>" --teacher "<teacher>" --json
kps teacher timetable --school "<school>" --region "<region>" --teacher "<teacher>" --json
```

## 4. Official Schedule Query

Goal:

- use NEIS schedule data with official metadata

Steps:

```bash
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-31 --json
```

For calendar export:

```bash
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-07 --ics
```

## 5. NEIS Dataset Dry Run

Goal:

- explain or preview an official dataset query before executing it

Steps:

```bash
kps neis classes --school "<school>" --region "<region>" --year 2026 --grade 3 --page-limit 2 --dry-run --format yaml
```

## 6. Timetable Freshness Diagnosis

Goal:

- distinguish parser bugs from upstream freshness issues

Steps:

```bash
kps doctor --live --json
kps debug provider neis --live --json
kps neis timetable --school "<school>" --region "<region>" --date 2026-03-12 --grade 3 --class-name 5 --json
```

Interpret:

- `NEIS_TIMETABLE_YEAR_LAG`
  - likely upstream freshness lag
- `NEIS_TIMETABLE_FILTER_NO_MATCH`
  - likely over-narrow query

## 7. Release Readiness

Goal:

- confirm the repo is ready for packaging or publish steps

Steps:

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:keyed
pnpm smoke:pack:cli
```

## 8. MCP-First Integration

Goal:

- use Kampus through typed tools instead of command parsing

Preferred tools:

- `search_schools`
- `get_school_info`
- `get_student_timetable_week`
- `get_teacher_timetable`
- `get_meals_today`
- `get_neis_dataset`

Rule:

- preserve `structuredContent`, `dataStatus`, and warning codes in downstream summaries
