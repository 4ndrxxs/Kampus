# TUI Handoff

Updated: 2026-03-12

This document is the handoff reference for anyone improving the Kampus human shell UI.

## Purpose

Kampus now has three CLI usage styles:

- raw commands
  - `kps school ...`
  - `kps class ...`
  - `kps meals ...`
  - `kps neis ...`
- human shell
  - `kps`
  - `kps human`
- easy mode
  - `kps easy`

The human shell is a presentation layer over the existing CLI engine. It must not change the meaning of raw commands or the data model.

## Non-Negotiable Contracts

These must stay visible and semantically intact:

- `dataStatus`
- `providerMetadata`
- `accessMode`
- `complete`
- `warnings`
- `official-full`
- `official-limited`
- `unofficial`
- `NEIS_TIMETABLE_YEAR_LAG`
- `NEIS_STALE_CACHE`
- `NEIS_PAGE_LIMIT`

Do not hide limited-mode or warning information just because the UI looks cleaner without it.

## Current TUI Structure

Entry orchestration:

- `packages/cli/src/tui/index.tsx`

Shared TUI use cases:

- `packages/cli/src/usecases/human.ts`

Shared TUI components:

- `packages/cli/src/tui/components.tsx`

Shared TUI pages:

- `packages/cli/src/tui/pages.tsx`

Shared page/type metadata:

- `packages/cli/src/tui/types.ts`
- `packages/cli/src/tui/shortcuts.ts`
- `packages/cli/src/tui/logo.ts`

## What the TUI Is Allowed to Change

- layout
- spacing
- color
- ascii logo treatment
- panel composition
- navigation affordances
- footer hints
- quick actions
- empty states
- warning presentation

## What the TUI Is Not Allowed to Change

- provider routing
- command behavior
- default provider priorities
- MCP contracts
- JSON output meaning
- config semantics
- profile semantics
- warning codes
- access-mode semantics

## UX Goals

- make the human shell feel like a product, not a debug view
- preserve raw-command trustworthiness
- keep the shell fast to scan
- make limited/full/unofficial states obvious
- allow first-time users to succeed through `easy` mode

## Current Human Shell Behavior

- `kps` launches the human shell only when stdin/stdout are TTY
- scripted or piped invocations stay in raw mode
- left/right arrow changes pages
- `h`, `s`, `t`, `m`, `y`, `g`, `p`, `?` jump to pages
- `i` opens IME-safe line input on text-entry screens
- `r` refreshes the current async page
- `e` switches into easy mode
- the shell uses a branded command-deck layout with panel headers, metric cards, and visible provider-state badges
- the shell keeps a dedicated input-focus banner visible so the active keyboard target stays obvious
- successful settings and profile changes raise a separate in-shell notice banner
- the schools page supports `1-9` recent-school quick picks when the query box is empty
- the teacher page is a dedicated first-class page, not a secondary detail view
- the settings page supports profile activation, recent-school re-apply, saving the current shell state back into a profile, and destructive-action confirmation inside the shell
- settings focus uses `Tab`, `Up/Down`, `Enter`, and `Esc` for confirm cancellation
- `Ctrl+C` exits

## Current Easy Mode Behavior

- welcome
- school search
- grade/class selection
- optional teacher name
- saves `easy-default`
- activates that profile

## Suggested Next UI Improvements

- denser dashboard packing on small terminal widths
- richer settings-page editing flows for creating or editing profiles in-shell
- staged loading polish for async pages and splash-to-home transitions
- stronger selected-row affordances in search-heavy screens
- tighter badge wrapping and truncation behavior on narrow terminals
- optional theme variants while keeping the same status semantics

## Validation Checklist

Before closing a TUI change, run:

```bash
pnpm verify
pnpm smoke:live
```

Recommended manual checks:

- `pnpm --filter @kampus/cli dev`
- `pnpm --filter @kampus/cli dev human`
- `pnpm --filter @kampus/cli dev easy`
- move across pages
- run school search
- reuse a recent school with `1-9` from the schools page
- activate a saved profile from Settings
- save the current shell state back into the active profile from Settings
- re-apply a recent school from Settings
- clear the default school from Settings
- remove a saved profile or recent-school entry from Settings
- confirm and cancel destructive settings actions
- complete easy mode
- confirm warnings still show in diagnostics
