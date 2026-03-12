# Kampus CLI Reference

Updated: 2026-03-12

This document is the detailed reference for the `kps` CLI surface.

## 0. Modes

Kampus now has three CLI usage styles:

- human shell
  - running `kps` with no arguments in an interactive TTY launches the human shell
  - `kps human` launches the same shell explicitly
- easy mode
  - `kps easy` launches a guided setup flow for school, class, and optional teacher defaults
- raw commands
  - all existing subcommands such as `school`, `class`, `teacher`, `meals`, `neis`, `doctor`, and `debug` remain unchanged

Mode rules:

- no-argument interactive launch only happens when both stdin and stdout are TTYs
- scripted or piped invocations stay in raw command mode
- the human shell is an extra layer over the existing command engine, not a replacement for it

## 1. Cross-Cutting Rules

### Output formats

Structured commands support:

- `human`
- `json`
- `markdown`
- `yaml`
- `csv`
- `table`
- `ndjson`

Selection rules:

- `--format <type>` wins
- otherwise `--json` forces `json`
- otherwise `--markdown` forces `markdown`
- otherwise output defaults to `human`

### Shared metadata

Most structured responses can include:

- `dataStatus`
  - `accessMode`: `unofficial`, `official-limited`, or `official-full`
  - `complete`: whether Kampus believes the result set is complete
  - `warnings`: provider warning codes such as `NEIS_KEYLESS_LIMITED`, `NEIS_TRUNCATED`, `NEIS_PAGE_LIMIT`, `NEIS_STALE_CACHE`, `NEIS_TIMETABLE_YEAR_LAG`
- `providerMetadata`
  - provider name
  - fetch time
  - cache indicator when applicable

### Defaults and saved state

Kampus can avoid repeated flags through saved state:

- saved `NEIS_API_KEY`
- default school
- recent schools
- active profile
- cache policy

Resolution behavior:

- school-bound commands can omit `--school` when a default school is set
- class-bound commands can omit `--grade` and `--class` when the active profile provides them
- teacher commands can omit `--teacher` when the active profile provides it

### Error contract and exit codes

When `--json` is set, CLI failures return:

```json
{
  "ok": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message"
  }
}
```

Current exit-code mapping:

- `2`: invalid input or CLI parse error
- `3`: school not found
- `4`: ambiguous school
- `5`: teacher not found
- `6`: meals or timetable unavailable
- `7`: provider unavailable
- `8`: network failure
- `9`: upstream changed
- `10`: internal error

## 2. Auth Commands

Group: `kps auth`

Commands:

- `status`
  - reports configured key state, source, storage mode, readability, preview, and warnings
- `login`
  - saves a NEIS key into config
  - Windows defaults to DPAPI-backed local storage
- `migrate`
  - upgrades a legacy plain-text saved key into the preferred local storage mode
- `validate`
  - checks whether the current key works against NEIS
- `logout`
  - removes the saved key from local config
- `export`
  - prints a shell command for exporting the current key into the environment

Examples:

```bash
kps auth status --json
kps auth login --api-key "<neis-api-key>"
kps auth migrate --json
kps auth validate --json
kps auth export --shell powershell
```

## 3. Config Commands

Group: `kps config`

Read commands:

- `show`
- `path`
- `cache-path`

Set commands:

- `set neis-api-key <key>`
- `set default-school <school> --region <region>`
- `set cache-dataset-ttl <minutes>`
- `set cache-stale-if-error <hours>`
- `set cache-max-entries <count>`

Clear commands:

- `clear neis-api-key`
- `clear default-school`
- `clear cache-policy`

Examples:

```bash
kps config show
kps config path
kps config cache-path
kps config set default-school "<school>" --region "<region>"
kps config set cache-dataset-ttl 30
kps config clear cache-policy
```

Notes:

- `config show` includes project and developer identity, but that metadata is embedded in the app and is read-only for end users
- only auth, default-school, profile, and cache values are user-configurable through `kps config`

## 4. Profile Commands

Group: `kps profile`

Profiles can save:

- school
- region
- grade
- class
- teacher
- activation state

Commands:

- `list`
- `show [name]`
- `save <name>`
- `use <name>`
- `clear-active`
- `remove <name>`

Examples:

```bash
kps profile save homeroom --school "<school>" --region "<region>" --grade 3 --class 5 --teacher "<teacher>" --activate --json
kps profile list --json
kps profile show homeroom --json
kps profile use homeroom
```

## 5. School Commands

Group: `kps school`

Commands:

- `search <keyword>`
  - merged Comcigan + NEIS school lookup
- `info`
  - normalized school info
  - prefers official NEIS school info
- `resolve <name>`
  - returns the merged school ref including provider identifiers

Examples:

```bash
kps school search "<keyword>" --json
kps school search "<keyword>" --format table
kps school resolve "<school>" --region "<region>" --json
kps school info --school "<school>" --region "<region>" --json
```

## 6. Student Timetable Commands

Group: `kps class`

Commands:

- `today`
- `day --weekday <1-7>`
- `week`

Related root commands:

- `kps next`
- `kps class-times`

Examples:

```bash
kps class today --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps class day --school "<school>" --region "<region>" --grade 3 --class 5 --weekday 1 --json
kps class week --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps next --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps class-times --school "<school>" --region "<region>" --json
```

Notes:

- these commands use Comcigan for timetable and class-time data
- active profile defaults are supported for grade and class

## 7. Teacher Commands

Group: `kps teacher`

Commands:

- `timetable`
- `info`

Examples:

```bash
kps teacher timetable --school "<school>" --region "<region>" --teacher "<teacher>" --json
kps teacher info --school "<school>" --region "<region>" --teacher "<teacher>" --json
```

Notes:

- teacher timetable and info are currently Comcigan-backed
- blank periods with a teacher assignment are not treated as free time

## 8. Meal Commands

Group: `kps meals`

Commands:

- `today`
- `week`
- `range`
- `month`

Examples:

```bash
kps meals today --school "<school>" --region "<region>" --date 2026-03-12 --json
kps meals week --school "<school>" --region "<region>" --date 2026-03-12 --json
kps meals range --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-07 --json
kps meals month --school "<school>" --region "<region>" --month 2026-03 --json
```

Notes:

- meals come from official NEIS
- no-key mode can still work, but broader queries can be truncated
- normalized output can include allergies, calories, nutrition, and origin info

## 9. Official NEIS Commands

Group: `kps neis`

Commands:

- `classes`
- `majors`
- `tracks`
- `schedule`
- `timetable`
- `classrooms`
- `academies`

Shared capabilities:

- `--page-limit`
- `--dry-run`
- structured output formats

Special behavior:

- `schedule --ics` returns an ICS calendar payload instead of JSON or human text
- `timetable` can surface `NEIS_TIMETABLE_NO_DATA`, `NEIS_TIMETABLE_FILTER_NO_MATCH`, and `NEIS_TIMETABLE_YEAR_LAG`

Examples:

```bash
kps neis classes --school "<school>" --region "<region>" --year 2026 --grade 3 --json
kps neis classes --school "<school>" --region "<region>" --year 2026 --grade 3 --page-limit 2 --dry-run --format yaml
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-31 --json
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-07 --ics
kps neis timetable --school "<school>" --region "<region>" --date 2026-03-12 --grade 3 --class-name 5 --json
```

## 10. Utility Commands

Commands:

- `kps export`
- `kps diff`

Examples:

```bash
kps export --school "<school>" --region "<region>" --grade 3 --class 5 --format json
kps diff --snapshot-a a.json --snapshot-b b.json --json
```

## 11. Diagnostics

Commands:

- `kps doctor`
- `kps doctor --live`
- `kps debug school [name]`
- `kps debug provider <comcigan|neis>`
- `kps debug neis-dataset <dataset>`

What they are for:

- `doctor`
  - configuration and readiness summary
- `doctor --live`
  - live provider smoke, including official timetable probe
- `debug school`
  - merged school resolution and provider refs
- `debug provider`
  - provider capability and live state
- `debug neis-dataset`
  - raw official dataset query execution

Examples:

```bash
kps doctor --json
kps doctor --live --json
kps debug school "<school>" --region "<region>" --json
kps debug provider neis --live --json
kps debug neis-dataset schoolInfo --query '{}' --json
```

## 12. Human Shell

Entry points:

- `kps`
- `kps human`
- `kps easy`

Human shell behavior:

- top-level navigation uses left and right arrows
- `h`, `s`, `t`, `m`, `y`, `g`, `p`, and `?` jump directly to major pages
- `i` opens IME-safe line input on text-entry screens
- `r` refreshes the current page
- `e` switches from human shell into easy mode
- `q` or `Ctrl+C` exits
- the shell uses a command-deck layout with a branded header, metric cards, panel headers, and visible status/warning badges
- settings and profile mutations raise a dedicated success banner
- an input-focus banner stays visible so the active keyboard target is obvious

Human shell pages:

- `Home`
  - split into mission-control summary, timetable, meals, and alerts panels
  - shows next class plus a short class-time preview when available
- `Schools`
  - typed search query with result cards and recent quick picks
  - `Enter` searches when the query changed
  - `Enter` again selects the highlighted school
  - `1-9` reuses a recent school immediately when the search box is empty
  - `I` opens an IME-safe line-capture flow for Korean or other composition-based input
- `Timetable`
  - student weekly timetable view with notes and weekly status summary
- `Meals`
  - weekly meal view with notes and weekly status summary
- `Teacher`
  - teacher info, notes, and teacher timetable summary
- `Diagnostics`
  - key state, storage mode, expected provider access modes, and warning ledger
- `Settings`
  - saved profile, default school, key source, and cache policy summary
  - `Tab` switches between the profile list, recent-school list, and actions list
  - `Up` and `Down` move the focused selection
  - `Enter` applies the focused profile or school, or runs the focused action
  - the actions list can save the current shell state to the active profile, save it into `human-shell`, clear the active profile, clear the default school, remove a selected profile, remove a selected recent school, or refresh the shell session
  - destructive actions open an in-shell confirmation panel and require a second `Enter`
- `Help`
  - key hints plus raw command reminders and design guardrails

Easy mode behavior:

- `Enter` advances through the guided flow
- `Esc` returns to the previous easy-mode step or back to human mode from the welcome screen
- school selection uses typed search plus up/down selection
- `I` opens an IME-safe line-capture flow on school-query and teacher-name steps
- grade and class are adjusted with arrow keys
- finishing easy mode saves an `easy-default` profile and activates it

Human shell status display:

- cards surface provider access mode directly
- official data pages show whether Kampus believes the result is `complete` or `partial`
- provider warning codes such as `NEIS_TIMETABLE_YEAR_LAG` remain visible in the shell instead of being hidden behind raw JSON

## 13. Recommended Command Sets

Fast local sanity check:

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:pack:cli
```

Full local sanity check with a real key:

```bash
pnpm verify
pnpm smoke:live
pnpm smoke:pack:cli
NEIS_API_KEY=your-real-neis-api-key pnpm smoke:keyed
```

