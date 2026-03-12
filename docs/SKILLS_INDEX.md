# Skills Index

This index maps common Kampus tasks to the most useful repo-local skill documents.

## Core Skill

- `skills/kampus/SKILL.md`
  - umbrella router for any Kampus task
  - start here if the task spans multiple product areas

## Domain Skills

- `skills/kampus-school/SKILL.md`
  - school search, resolve, merged refs, school info
- `skills/kampus-timetable/SKILL.md`
  - student timetable, teacher timetable, next class, class-time rails
- `skills/kampus-meals/SKILL.md`
  - meal queries and meal metadata interpretation
- `skills/kampus-neis/SKILL.md`
  - official dataset work, schedule, classes, majors, tracks, classrooms, academies
- `skills/kampus-ops/SKILL.md`
  - verification, smoke checks, diagnostics, release-adjacent work

## Recommended Routing

### School identity problem

Use:

1. `skills/kampus/SKILL.md`
2. `skills/kampus-school/SKILL.md`

### Timetable summary or debugging

Use:

1. `skills/kampus/SKILL.md`
2. `skills/kampus-timetable/SKILL.md`

### Meals or school lunch task

Use:

1. `skills/kampus/SKILL.md`
2. `skills/kampus-meals/SKILL.md`

### Official NEIS dataset task

Use:

1. `skills/kampus/SKILL.md`
2. `skills/kampus-neis/SKILL.md`

### Release, smoke, packaging, or upstream outage

Use:

1. `skills/kampus/SKILL.md`
2. `skills/kampus-ops/SKILL.md`

## Agent Recipes

For scenario-driven workflows, see:

- [Agent guide](./AGENT_GUIDE.md)
- [CLI reference](./CLI_REFERENCE.md)
- [Operator runbook](./OPERATOR_RUNBOOK.md)
- [Upstream verification](./UPSTREAM_VERIFICATION.md)

Recommended recipes:

- School onboarding:
  - search -> resolve -> save default school -> save profile
- Daily student brief:
  - class today/week -> meals today/week -> next
- Timetable diagnosis:
  - doctor -> doctor --live -> debug provider -> debug dataset
- Release readiness:
  - verify -> smoke:live -> smoke:keyed -> smoke:pack:cli
