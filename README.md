<div align="center">

<br>

# Kampus

**The Korean School Information Toolkit**<br>
<sub>한국 학교 정보 통합 도구</sub>

<br>

*One engine, three surfaces — interactive shell · raw CLI · MCP server*

<br>

[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat-square)](LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%E2%89%A5%2020-16a34a?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-f69220?style=flat-square)](https://pnpm.io/)
[![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-64748b?style=flat-square)](#)
[![AI Agent Ready](https://img.shields.io/badge/AI%20agent-ready-8b5cf6?style=flat-square)](#-ai-agent-onboarding)

</div>

<br>

---

**Kampus** merges two Korean school data providers — **Comcigan** (practical timetables) and **NEIS Open API** (official government data) — into one unified engine. Use it as an interactive terminal app, pipe it through scripts with `--json`, or connect it as an MCP server for AI agents and integrations.

Every response carries transparent **data status** — `official-full`, `official-limited`, or `unofficial` — so you always know where your data came from and how complete it is.

---

<br>

## Three Surfaces

<table>
<tr>
<td width="33%" valign="top">

### 🖥️ Human Shell

Full interactive terminal experience.

- Mission-control dashboard
- School search with quick picks
- Timetable & meal panels
- Profile & settings management
- IME-safe Korean text input
- Guided `easy` onboarding mode
- Live provider state badges

**Launch:**

`kps` · `kps human` · `kps easy`

</td>
<td width="33%" valign="top">

### ⚡ Raw CLI

Scriptable commands, structured output.

- Complete school, timetable, meal commands
- 6 structured output formats
- Auth, config & profile management
- Built-in diagnostics & debugging
- Structured JSON error responses
- Default school & profile support

**Example:**

`kps class week --json`

</td>
<td width="33%" valign="top">

### 🔌 MCP Server

Typed tools for agents & integrations.

- 13 structured MCP tools
- School, timetable, meals, NEIS
- Timetable snapshot diffing
- Full `structuredContent` output
- `dataStatus` on every response

**Build & run:**

`pnpm --filter @kampus/mcp build`<br>
`node packages/mcp/dist/server.js`

</td>
</tr>
</table>

<br>

## 🚀 Quick Start

**Install & verify:**

```bash
pnpm install
pnpm verify                # lint + typecheck + build + test
pnpm smoke:live            # live provider health check
pnpm smoke:pack:cli        # packaged CLI smoke test
```

**Launch the interactive shell:**

```bash
pnpm --filter @kampus/cli dev          # auto-detects TTY → human shell
pnpm --filter @kampus/cli dev human    # explicit human shell
pnpm --filter @kampus/cli dev easy     # guided onboarding flow
```

**Run raw commands:**

```bash
kps school search "<keyword>"
kps class week --school "<school>" --region "<region>" --grade 3 --class 5 --json
kps meals today --school "<school>" --region "<region>" --json
kps neis schedule --school "<school>" --region "<region>" --from 2026-03-01 --to 2026-03-31 --json
kps doctor --live --json
```

**Save a NEIS API key** (optional, unlocks full official mode):

```bash
kps auth login --api-key "<your-neis-key>"
kps auth status --json
```

> [!TIP]
> A NEIS key is **optional**. Without one, you get merged school search, all Comcigan timetable features, and limited official NEIS data. A real key unlocks complete official results and broader dataset queries.

<br>

## 📋 Feature Overview

| Domain | Commands | Provider | Data Status |
|:-------|:---------|:---------|:------------|
| **School Search** | `school search` · `school resolve` · `school info` | Comcigan + NEIS | merged |
| **Student Timetable** | `class today` · `class day` · `class week` · `next` · `class-times` | Comcigan | `unofficial` |
| **Teacher** | `teacher info` · `teacher timetable` | Comcigan | `unofficial` |
| **Meals** | `meals today` · `meals week` · `meals range` · `meals month` | NEIS | `official` |
| **Official Datasets** | `neis classes` · `majors` · `tracks` · `schedule` · `timetable` · `classrooms` · `academies` | NEIS | `official` |
| **Auth & Config** | `auth login` · `status` · `validate` · `export` · `logout` | — | — |
| **Profiles** | `profile save` · `list` · `show` · `use` · `remove` | — | — |
| **Diagnostics** | `doctor` · `doctor --live` · `debug provider` · `debug school` · `debug neis-dataset` | Both | — |
| **Utilities** | `export` · `diff` | — | — |

<details>
<summary><strong>Output Formats</strong></summary>

<br>

All structured commands support multiple output formats:

| Flag | Format |
|:-----|:-------|
| `--json` | JSON |
| `--format yaml` | YAML |
| `--format csv` | CSV |
| `--format table` | Table |
| `--format markdown` | Markdown |
| `--format ndjson` | Newline-delimited JSON |

Default output is `human` (formatted for terminal reading).

</details>

<details>
<summary><strong>MCP Tools</strong></summary>

<br>

| Tool | Description |
|:-----|:-----------|
| `search_schools` | Merged school search |
| `get_school_info` | Normalized school info |
| `get_student_timetable_today` | Today's class schedule |
| `get_student_timetable_day` | Specific day schedule |
| `get_student_timetable_week` | Full weekly timetable |
| `get_teacher_timetable` | Teacher's schedule |
| `get_teacher_info` | Teacher info |
| `get_next_class` | Next upcoming class |
| `get_class_times` | Period start/end times |
| `get_meals_today` | Today's meals |
| `get_meals_week` | Weekly meal plan |
| `get_neis_dataset` | Official NEIS dataset query |
| `diff_timetable_snapshots` | Compare timetable snapshots |

</details>

<details>
<summary><strong>Human Shell Pages</strong></summary>

<br>

| Key | Page | What it shows |
|:---:|:-----|:-------------|
| <kbd>h</kbd> | Home | Dashboard: next class, timetable preview, meals, alerts |
| <kbd>s</kbd> | Schools | Search with result cards + recent quick picks (<kbd>1</kbd>–<kbd>9</kbd>) |
| <kbd>t</kbd> | Timetable | Weekly student timetable with status summary |
| <kbd>m</kbd> | Meals | Weekly meal view with notes |
| <kbd>y</kbd> | Teacher | Teacher info & timetable summary |
| <kbd>g</kbd> | Diagnostics | Key state, provider access modes, warning ledger |
| <kbd>p</kbd> | Settings | Profiles, default school, cache, destructive actions with confirmation |
| <kbd>?</kbd> | Help | Keyboard hints and design notes |

Navigation: <kbd>←</kbd> <kbd>→</kbd> arrows, <kbd>i</kbd> IME input, <kbd>r</kbd> refresh, <kbd>e</kbd> easy mode, <kbd>q</kbd> quit.

</details>

<br>

## 🔐 Access Model

Every Kampus response includes transparent provenance via `dataStatus`:

| Status | Meaning | Requires |
|:-------|:--------|:---------|
| **`official-full`** | Authoritative NEIS data, complete results | Real `NEIS_API_KEY` |
| **`official-limited`** | Official NEIS data, may be truncated by sample cap | No key needed |
| **`unofficial`** | Comcigan data — practical but upstream-fragile | No key needed |

<table>
<tr>
<td width="50%" valign="top">

**Without a NEIS key**

- ✅ Merged school search & resolve
- ✅ Comcigan student / teacher timetables
- ✅ Limited NEIS school info, meals, datasets
- ⚠️ Broader queries may be truncated

</td>
<td width="50%" valign="top">

**With a real NEIS key**

- ✅ Everything from keyless mode
- ✅ Full official results, no truncation
- ✅ Broader schedule and dataset queries
- ✅ Full month meal queries

</td>
</tr>
</table>

> [!NOTE]
> `KEY=SAMPLE` is no longer valid for NEIS and returns `ERROR-290`. Omitting the key still works for some endpoints in limited sample mode. See [Upstream Verification](./docs/UPSTREAM_VERIFICATION.md) for full details.

<br>

## 🤖 AI Agent Onboarding

> [!IMPORTANT]
> **This repository is agent-ready.** It ships with guardrails, task routing, and structured workflows for coding agents like Claude Code, Codex, and Cursor.

### Quick start for agents

Point your agent at this repo and paste this prompt:

```text
This repository has agent instructions and task-specific skills.
Start with AGENTS.md, then read docs/AGENT_GUIDE.md and docs/SKILLS_INDEX.md.
Use the appropriate Kampus skill from skills/ for school, timetable, meals, NEIS, or ops work.
Preserve raw CLI and MCP contracts unless the task explicitly changes them.
```

### What the agent gets

| File | Purpose |
|:-----|:--------|
| [`AGENTS.md`](./AGENTS.md) | Repo-wide guardrails and product boundaries |
| [`docs/AGENT_GUIDE.md`](./docs/AGENT_GUIDE.md) | Surface selection, provider model, verification matrix |
| [`docs/SKILLS_INDEX.md`](./docs/SKILLS_INDEX.md) | Task → domain skill routing map |
| [`docs/AGENT_RECIPES.md`](./docs/AGENT_RECIPES.md) | Copy-paste agent workflows (onboarding, daily brief, diagnosis, release) |
| [`skills/`](./skills/) | Domain-specific skill documents |

### Skill routing

```
skills/kampus/SKILL.md            ← start here (umbrella router)
  ├── kampus-school/SKILL.md      school search, resolve, info
  ├── kampus-timetable/SKILL.md   student & teacher timetable
  ├── kampus-meals/SKILL.md       meal queries & metadata
  ├── kampus-neis/SKILL.md        official NEIS datasets
  └── kampus-ops/SKILL.md         verification, diagnostics, release
```

### Agent guardrails

- Preserve `dataStatus`, `providerMetadata`, `warnings`, `accessMode`, `complete`
- Preserve the Comcigan / NEIS provider split
- Use `--json` for scripted work; MCP for tool-calling clients
- Do not hide warning metadata to make output look cleaner
- Project and developer identity is **read-only** build metadata

<br>

## 📦 Architecture

```
kampus/
├── packages/
│   ├── core/                @kampus/core
│   │   └── src/             Shared types, config, cache, routing, normalization
│   ├── providers/
│   │   ├── comcigan/        @kampus/provider-comcigan
│   │   │   └── src/         Unofficial timetable provider (dynamic route parsing)
│   │   └── neis/            @kampus/provider-neis
│   │       └── src/         Official NEIS Open API provider (key/keyless modes)
│   ├── cli/                 @kampus/cli
│   │   └── src/             CLI commands, human shell, easy mode, TUI components
│   └── mcp/                 @kampus/mcp
│       └── src/             MCP server with 13 typed tools
├── skills/                  Agent skill documents (6 domain skills)
├── docs/                    Reference documentation
├── scripts/                 Build, pack, and release scripts
└── .github/workflows/       CI, live smoke, release pipelines
```

| Package | Role |
|:--------|:-----|
| **`@kampus/core`** | Normalized types, config, cache, provider routing, snapshot diff |
| **`@kampus/provider-comcigan`** | Unofficial Comcigan provider — dynamic `/st` route parsing, EUC-KR search, split-factor decode |
| **`@kampus/provider-neis`** | Official NEIS provider — keyed/keyless modes, truncation detection, dataset pagination |
| **`@kampus/cli`** | `kps` binary — human shell, easy mode, raw commands, multi-format output, profiles, auth |
| **`@kampus/mcp`** | MCP server — 13 tools, `structuredContent`, transparent `dataStatus` |

<details>
<summary><strong>Core design decisions</strong></summary>

<br>

- **Merged school identity** — Schools are a `providerRefs` object holding both Comcigan and NEIS identifiers, enabling operation-based routing instead of provider-locked resolution.

- **Shared result model** — CLI JSON output and MCP `structuredContent` use the same `dataStatus` + `providerMetadata` model. No separate output abstractions.

- **Transparent warnings** — Provider warning codes (`NEIS_TIMETABLE_YEAR_LAG`, `NEIS_STALE_CACHE`, `NEIS_PAGE_LIMIT`, etc.) flow through to consumers instead of being swallowed.

- **Structured errors** — JSON mode returns typed error objects with semantic exit codes (2–10) for script consumption.

</details>

<br>

## 📚 Documentation

| Document | Covers |
|:---------|:-------|
| [**CLI Reference**](./docs/CLI_REFERENCE.md) | Complete command reference — modes, flags, output formats, exit codes |
| [**Operator Runbook**](./docs/OPERATOR_RUNBOOK.md) | Setup, smoke checks, key rotation, release flow, incident playbooks |
| [**Agent Guide**](./docs/AGENT_GUIDE.md) | Surface selection, provider model, metadata contracts, verification |
| [**Agent Recipes**](./docs/AGENT_RECIPES.md) | Compact repeatable workflows — onboarding, daily brief, diagnosis, release |
| [**Skills Index**](./docs/SKILLS_INDEX.md) | Task → skill routing map for agents |
| [**TUI Handoff**](./docs/TUI_HANDOFF.md) | Human shell design contracts, UX boundaries, suggested improvements |
| [**Upstream Verification**](./docs/UPSTREAM_VERIFICATION.md) | Live upstream checks, implementation rules, repo inspections |
| [**Architecture Deep Dive**](./REPO_DEEPDIVE_REPORT.md) | Full architecture review, packaging, remaining risks |

<br>

## ✅ Validation & Quality Gates

```bash
pnpm verify                              # lint + typecheck + build + test
pnpm smoke:live                          # live provider health (no key required)
pnpm smoke:pack:cli                      # packed CLI tarball install + startup
NEIS_API_KEY=<key> pnpm smoke:keyed      # full official NEIS validation
```

| CI Workflow | Trigger | What it does |
|:------------|:--------|:-------------|
| **`ci.yml`** | Push / PR | Verify on Ubuntu, Windows, macOS · Packed CLI smoke |
| **`live-smoke.yml`** | Every 6 hours | Live provider smoke · Auto-opens/closes GitHub issues on failure |
| **`release.yml`** | `v*` tag | Verify → pack → smoke-install → upload artifact → npm publish |

<br>

## ⚠️ Limitations

> [!WARNING]
> **Comcigan is unofficial.** It provides practical timetable data but can break without notice if the upstream changes its payload format or endpoints.

> [!CAUTION]
> **No-key NEIS is useful but limited.** Sample-mode queries may be truncated at 5 rows. A real `NEIS_API_KEY` is required for production-grade completeness.

- Official NEIS timetable data can lag behind other datasets for the same school and academic year.
- Windows uses DPAPI for local secret storage. Non-Windows environments fall back to plain-text config unless environment variables are used.
- Project and developer identity metadata is embedded in the build and is **read-only** for users.

<br>

---

<div align="center">

<sub>

**Kampus** · [`github.com/4ndrxxs/Kampus`](https://github.com/4ndrxxs/Kampus) · MIT License

Built by **Juwon Seo** · `contact@seojuwon.com`

</sub>

</div>
