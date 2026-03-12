---
name: kampus-meals
description: Query and interpret Kampus meal data from official NEIS endpoints. Use when the task is about school meals, lunch menus, weekly meals, monthly meals, allergies, nutrition, calories, or meal completeness.
---

# Kampus Meals

Meals are NEIS-backed and should be explained with their official metadata.

## Preferred Commands

```bash
kps meals today --school "<school>" --region "<region>" --date 2026-03-12 --json
kps meals week --school "<school>" --region "<region>" --date 2026-03-12 --json
kps meals range --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-07 --json
kps meals month --school "<school>" --region "<region>" --month 2026-03 --json
```

## Interpretation Rules

- Preserve allergies, calories, nutrition, origin info, and raw rows when they matter.
- Treat no-key meal responses as potentially truncated when metadata says `official-limited` or `complete: false`.
- Do not imply completeness when monthly or broad-range queries hit sample limits.

## References

- `docs/CLI_REFERENCE.md`
- `docs/AGENT_GUIDE.md`
