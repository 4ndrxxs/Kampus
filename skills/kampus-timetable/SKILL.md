---
name: kampus-timetable
description: Use Kampus for student timetable, teacher timetable, next-class, and class-time workflows. Trigger when the task is about class schedules, teacher views, timetable interpretation, next class, or class-time slots.
---

# Kampus Timetable

Prefer raw CLI with `--json` for automation and validation. Use the human shell only when checking terminal UX.

## Preferred Commands

```bash
kps class today --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps class day --school "<school>" --region "<region>" --grade 3 --class 5 --weekday 1 --json
kps class week --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps next --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps class-times --school "<school>" --region "<region>" --json
kps teacher info --school "<school>" --region "<region>" --teacher "<teacher>" --json
kps teacher timetable --school "<school>" --region "<region>" --teacher "<teacher>" --json
```

## Interpretation Rules

- Treat occupied blank periods as `unknown-subject`, not free time.
- Do not call a period free if a teacher is assigned.
- Treat Comcigan-backed timetable data as `unofficial`.

## References

- `docs/CLI_REFERENCE.md`
- `docs/UPSTREAM_VERIFICATION.md`
