# Upstream Verification

Checked on 2026-03-12 (Asia/Seoul).

## Why this exists

NEIS and Comcigan community repositories drift often. Before changing provider logic, Kampus should rely on:

1. direct GitHub code inspection
2. live endpoint verification against the current upstream

This document records the repositories and live behaviors used for the current Comcigan and NEIS implementation pass.

## Repositories inspected

### Comcigan

- `leegeunhyeok/comcigan-parser`
  - inspected: `index.js`, README flow around search, timetable, and class-time access
  - verified: dynamic route extraction from `/st`, EUC-KR search encoding

- `star0202/comcigan.ts`
  - inspected: all files under `src/` and tests under `test/`
  - verified: current host `http://comci.net:4082`, dynamic `/st` parsing, daily route cache, search response cleanup
  - caveat: its decode logic does not fully match the 2026 live payload when the split factor is `1000` and section prefixes are present

- `Coder-Iro/comcigan-py`
  - inspected: all files under `comcigan/`, plus tests
  - verified: `/st` refresh-loop handling, dynamic route extraction, EUC-KR search encoding

- `darkapplepower/comcigan`
  - inspected: entire repo
  - useful clue: the current payload exposes a split factor, and section prefixes such as `A_` are derived from the subject code

- `Astro36/korean-school`
  - inspected: `lib/*.js`, tests, schemas
  - useful for: historical meaning of class-time fields and teacher schedule derivation
  - caveats: static school DB, old school-info HTML scraping, old meal pages, older Comcigan assumptions

### NEIS

- `my-school-info/neis-api`
  - inspected: all source files under `src/`
  - verified: official NEIS JSON shape, `RESULT.CODE` and `RESULT.MESSAGE` handling, endpoint naming

- `callistoteam/schoolbot`
  - inspected: bot entrypoint, all cogs, db/utils code, tests
  - verified: real-world usage prefers official NEIS via `neispy` for school search, meals, schedules, and timetables

- `star0202/neis.ts`
  - inspected: `src/client.ts`, `src/http.ts`, all dataset wrappers
  - verified: current official dataset naming, modern wrapper shape, school-type timetable selection

- `RKDH2/neis-api.ts`
  - inspected: service wrappers and protocol types under `src/services/`
  - verified: modern official request/response typing and broad dataset coverage

- old or fragile meal scrapers inspected and rejected as production sources:
  - `identity16/neis-meal`
  - `0Geuni/NeisMeal-Parser`
  - `code-yeongyu/neispy`
  - `dydgns2017/school-api-python`
  - `agemor/neis-api`
  - common issue: dependence on older `stu.*` student-service pages or `schoolinfo.go.kr`

## Live upstream checks

### Comcigan

Verified directly against `http://comci.net:4082`.

- `GET /st`
  - dynamic route values are still required
  - route numbers should not be hardcoded

- school search request shape
  - `GET /{mainRoute}?{searchRoute}l{EUC-KR-percent-encoded-keyword}`

- critical search finding
  - the timetable school code is tuple index `3`
  - tuple index `0` is not safe to use as the timetable identifier

- timetable payload request shape
  - `GET /{mainRoute}_T?base64("{prefix}{schoolCode}_0_1")`

- critical timetable findings
  - the payload block Kampus maps as `data481` is the original timetable
  - the payload block Kampus maps as `data147` is the current timetable and can contain changes not present in `data481`
  - the split factor is `1000` in the current live payload
  - class-time data can appear as string entries like `1(09:10)` instead of numeric minute pairs

- current decode rule derived from live payload and repo cross-check
  - when `split == 100`
    - `teacher = floor(value / 100)`
    - `subject = value % 100`
  - when `split > 100`
    - `teacher = value % split`
    - `subjectCode = floor(value / split)`
    - `section = floor(subjectCode / split)`
    - `subject = subjectCode % split`
  - when `section > 0`, the user-facing label should be prefixed like `A_`, `B_`, and so on

### NEIS

Verified directly against `https://open.neis.go.kr/hub`.

- `KEY=SAMPLE` now returns:
  - `ERROR-290`
  - meaning: the API key is invalid or missing

- omitting `KEY` still works for some official endpoints in a limited sample mode
  - verified endpoints:
    - `schoolInfo`
    - `mealServiceDietInfo`
    - `SchoolSchedule`
    - `classInfo`

- sample-mode behavior observed on 2026-03-12
  - exact school lookup can succeed without a key
  - single-day meals can succeed without a key
  - weekday meal ranges can succeed without a key when the row count stays within the sample cap
  - broader queries are truncated

- concrete live checks
  - an exact `schoolInfo` lookup for a known school returned `INFO-000` without a key
  - a single-day `mealServiceDietInfo` lookup returned `INFO-000` without a key
  - a broad `schoolInfo` query returned `list_total_count=2551` but only `5` rows
  - a month `SchoolSchedule` query returned `list_total_count=10` but only `5` rows
  - a yearly `classInfo` query returned `list_total_count=15` but only `5` rows
  - a two-week `mealServiceDietInfo` range returned `list_total_count=10` but only `5` rows
  - a five-day school-week `mealServiceDietInfo` range returned `list_total_count=5` and all `5` rows

Implications:

- `SAMPLE` fallback is no longer valid
- a real `NEIS_API_KEY` is still required for complete production results
- keyless official access is still useful, but it must be treated as limited and potentially truncated
- official timetable freshness can lag behind other datasets for the same school and year
- this lag should be surfaced as diagnostics, not silently treated as a parser failure

## Implementation rules adopted in Kampus

- parse Comcigan routes dynamically from `/st`; do not hardcode route numbers
- encode Comcigan school-search keywords in EUC-KR
- treat Comcigan search responses as UTF-8 JSON with trailing NUL padding
- store the Comcigan timetable school code from tuple index `3`
- prefer `data147` over `data481` for student timetable reads
- decode class and teacher codes from the payload split factor instead of assuming a fixed width
- preserve section prefixes such as `A_` when present
- parse Comcigan class-time string arrays when numeric minute pairs are unavailable
- treat NEIS `ERROR-290` as an invalid-key failure
- when `KEY` is omitted, treat official NEIS responses as limited sample mode and detect truncation via `list_total_count`
- expose official result state explicitly as `official-full` or `official-limited` with completion warnings
- keep official timetable no-row results successful when the likely issue is a school-level year lag, and surface warning codes instead of throwing a provider failure

## Kampus files changed from this verification pass

- `packages/providers/comcigan/src/provider.ts`
- `packages/providers/comcigan/src/provider.test.ts`
- `packages/providers/neis/src/provider.ts`
- `packages/providers/neis/src/provider.test.ts`
