# Kampus Operator Runbook

Updated: 2026-03-12

This runbook is the operator-facing reference for local setup, smoke checks, release flow, key rotation, and common production incidents.

## 1. Baseline

Kampus currently has two upstream sources:

- `Comcigan`
  - unofficial
  - used for student timetable, teacher timetable, teacher info, next class, and class times
- `NEIS`
  - official Open API
  - used for school search augmentation, school info, meals, and official dataset queries

Core reliability rules:

- `pnpm verify` must pass before any release or smoke interpretation.
- `pnpm smoke:live` checks live provider readiness without assuming a key.
- `pnpm smoke:pack:cli` checks that the packed CLI tarball installs and starts cleanly in a temp environment.
- `pnpm smoke:keyed` checks full official NEIS mode and requires a readable NEIS key from env or saved config.
- `docs/CLI_REFERENCE.md` is the detailed command reference when an operator needs exact command shapes.

## 2. Required Secrets and Storage

Production-grade completeness requires a real `NEIS_API_KEY`.

Local key setup:

```bash
pnpm --filter @kampus/cli dev auth login --api-key "<neis-api-key>"
pnpm --filter @kampus/cli dev auth status --json
```

Windows storage behavior:

- new saved keys default to `windows-dpapi`
- existing plain-text config keys can be upgraded with:

```bash
pnpm --filter @kampus/cli dev auth migrate --json
```

Fallback behavior:

- on non-Windows environments, config storage falls back to plain text
- environment variable override is still supported and wins over config

Export helper:

```bash
pnpm --filter @kampus/cli dev auth export --shell powershell
pnpm --filter @kampus/cli dev auth export --shell bash
```

## 3. First-Time Local Bring-Up

```bash
pnpm install
pnpm verify
pnpm smoke:live
pnpm smoke:pack:cli
NEIS_API_KEY=your-real-neis-api-key pnpm smoke:keyed
```

Recommended local defaults:

```bash
pnpm --filter @kampus/cli dev config set default-school "<school>" --region "<region>"
pnpm --filter @kampus/cli dev profile save homeroom --school "<school>" --region "<region>" --grade 3 --class 5 --teacher "<teacher>" --activate --json
```

Optional cache tuning:

```bash
pnpm --filter @kampus/cli dev config set cache-dataset-ttl 30
pnpm --filter @kampus/cli dev config set cache-stale-if-error 48
pnpm --filter @kampus/cli dev config set cache-max-entries 500
```

## 4. Ongoing Health Checks

Daily local checks:

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:pack:cli
pnpm smoke:keyed
```

Useful operator commands:

```bash
pnpm --filter @kampus/cli dev doctor --json
pnpm --filter @kampus/cli dev doctor --live --json
pnpm --filter @kampus/cli dev debug provider neis --live --json
pnpm --filter @kampus/cli dev debug school "<school>" --region "<region>" --json
pnpm --filter @kampus/cli dev debug neis-dataset schoolInfo --query '{}' --json
```

GitHub Actions:

- `.github/workflows/ci.yml`
  - verify on Ubuntu, Windows, and macOS
  - packed CLI smoke on Ubuntu
- `.github/workflows/live-smoke.yml`
  - scheduled every 6 hours
  - no-key live smoke
  - keyed live smoke when `NEIS_API_KEY` secret exists
  - uploads smoke artifacts and writes workflow summaries
  - opens or updates a dedicated GitHub issue when a smoke job fails
  - closes the matching issue automatically when the next smoke succeeds
- `.github/workflows/release.yml`
  - runs on `v*` tags
  - verifies, packs a release CLI tarball, smoke-installs that tarball, uploads artifact, publishes npm package when `NPM_TOKEN` exists

## 5. Interpreting Status and Warnings

`dataStatus.accessMode`

- `unofficial`
  - Comcigan path
- `official-limited`
  - NEIS keyless sample mode
- `official-full`
  - NEIS with real key

Important warning codes:

- `NEIS_KEYLESS_LIMITED`
  - no key in use
  - result may be truncated
- `NEIS_TRUNCATED`
  - NEIS returned fewer rows than total count
- `NEIS_PAGE_LIMIT`
  - Kampus hit the configured auto-pagination ceiling
- `NEIS_STALE_CACHE`
  - live NEIS request failed and Kampus returned stale cached data
- `NEIS_TIMETABLE_NO_DATA`
  - official timetable query returned no rows
- `NEIS_TIMETABLE_FILTER_NO_MATCH`
  - same school and year appear to have timetable rows, but current filter is too narrow
- `NEIS_TIMETABLE_YEAR_LAG`
  - school exposes an older academic year in official timetable rows

## 6. Incident Playbooks

### A. `NEIS_API_KEY` appears invalid

Symptoms:

- `auth validate` fails
- keyed smoke fails
- doctor reports provider unavailable

Actions:

1. Run:

```bash
pnpm --filter @kampus/cli dev auth status --json
pnpm --filter @kampus/cli dev auth validate --json
```

2. If the local key is wrong, re-save it:

```bash
pnpm --filter @kampus/cli dev auth login --api-key "<new-key>"
```

3. If CI keyed smoke fails, rotate the repository secret:
   - update `NEIS_API_KEY` in GitHub Actions secrets
   - rerun `live-smoke.yml`

### B. Official timetable is empty

Symptoms:

- official timetable query returns success with warning codes

Actions:

1. Run:

```bash
pnpm --filter @kampus/cli dev doctor --live --json
pnpm --filter @kampus/cli dev debug provider neis --live --json
```

2. Interpret the warnings:
   - `NEIS_TIMETABLE_YEAR_LAG`: upstream school data is behind; this is not necessarily a code bug
   - `NEIS_TIMETABLE_FILTER_NO_MATCH`: relax `school-course`, `day-night`, `track`, or `department`
   - `NEIS_TIMETABLE_NO_DATA`: school may not publish official timetable rows for that query

3. Fall back to Comcigan timetable features when applicable.

### C. Comcigan appears broken

Symptoms:

- school search loses Comcigan refs
- student or teacher timetable suddenly fails

Actions:

1. Run:

```bash
pnpm --filter @kampus/cli dev debug provider comcigan --live --json
pnpm --filter @kampus/cli dev school search "<known-school>" --json
```

2. Compare with `docs/UPSTREAM_VERIFICATION.md`.
3. Re-verify upstream route and payload shape before changing the parser.
4. Do not import third-party static school databases as a shortcut.

### D. `NEIS_STALE_CACHE` appears

Symptoms:

- dataset result succeeds with stale-cache warning

Meaning:

- live NEIS request failed
- Kampus returned cached data inside the stale-if-error window

Actions:

1. Retry the same command.
2. Run `doctor --live --json`.
3. If live checks are failing broadly, treat this as an upstream or network incident.
4. If needed, reduce or reset cache policy:

```bash
pnpm --filter @kampus/cli dev config clear cache-policy
```

## 7. Key Rotation

Local rotation:

```bash
pnpm --filter @kampus/cli dev auth logout
pnpm --filter @kampus/cli dev auth login --api-key "<replacement-key>"
pnpm --filter @kampus/cli dev auth status --json
pnpm smoke:keyed
```

CI rotation:

1. update GitHub Actions secret `NEIS_API_KEY`
2. rerun `live-smoke.yml`
3. verify keyed smoke is green again
4. confirm any open `[ops] Kampus keyed live smoke failure` issue is closed on recovery

## 8. Release Flow

Before tagging:

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:pack:cli
pnpm smoke:keyed
```

Repository prerequisites:

- GitHub Actions secret `NEIS_API_KEY`
- GitHub Actions secret `NPM_TOKEN` when npm publish is desired

What release now does:

- verify the workspace
- create a release CLI tarball that bundles internal workspace code
- smoke-install that tarball into a clean environment
- upload the tarball as a workflow artifact
- publish the tarball to npm when token and tag conditions are satisfied

Release trigger:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Expected release outputs:

- CLI tarball in workflow artifacts
- tarball is install-smoke-tested before publish
- npm publish when `NPM_TOKEN` exists

Post-release checks:

1. download the workflow artifact and confirm expected tarball name
2. confirm the npm package version matches the tag
3. run `kps --version` from the published install
4. run `kps doctor --json` from the published install
5. if a real key is available in the target environment, run `kps doctor --live --json`

## 9. Current Known Limits

- Comcigan remains unofficial and can break without notice.
- No-key NEIS remains useful but incomplete.
- Official NEIS timetable rows can lag behind other school datasets.
- Windows has protected local key storage; non-Windows still falls back to plain-text config unless env-based secrets are used.
