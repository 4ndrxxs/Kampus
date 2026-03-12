---
name: kampus-ops
description: Operate, verify, and release Kampus safely. Use when the task is about smoke checks, provider diagnostics, packaging, release readiness, upstream outages, cache behavior, key validation, or incident-style troubleshooting.
---

# Kampus Ops

Prefer command paths that produce deterministic structured output.

## Verification Order

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:keyed
pnpm smoke:pack:cli
```

## Diagnostics

```bash
kps doctor --json
kps doctor --live --json
kps debug school "<school>" --region "<region>" --json
kps debug provider neis --live --json
kps debug provider comcigan --live --json
kps debug neis-dataset schoolInfo --query '{}' --json
```

## Interpretation Rules

- Treat live smoke failures as upstream or environment signals first, not immediately as product regressions.
- Treat `NEIS_TIMETABLE_YEAR_LAG` as an upstream freshness signal.
- Treat Comcigan failures as plausible external instability because the upstream is unofficial.

## References

- `docs/OPERATOR_RUNBOOK.md`
- `docs/UPSTREAM_VERIFICATION.md`
- `docs/CODEX_AUDIT.md`
