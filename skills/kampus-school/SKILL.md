---
name: kampus-school
description: Resolve Korean schools, merged provider refs, and normalized school info in Kampus. Use when work centers on school search, school resolve, school identity disambiguation, default-school setup, or school info retrieval.
---

# Kampus School

Use MCP school tools when an MCP client is already active. Otherwise use raw CLI with `--json`.

## Workflow

1. Search or resolve the school first.
2. Confirm merged refs when the result looks ambiguous.
3. Reuse the resolved school or saved default school for deeper operations.
4. Preserve `dataStatus`, `providerMetadata`, and warnings in summaries.

## Preferred Commands

```bash
kps school search "<keyword>" --json
kps school resolve "<school>" --region "<region>" --json
kps school info --school "<school>" --region "<region>" --json
kps config set default-school "<school>" --region "<region>"
```

## Interpretation Rules

- Do not treat school name alone as a stable identity when provider refs are available.
- Prefer merged refs instead of forcing a single-provider school model.
- Treat no-key NEIS school info as potentially limited when metadata says `official-limited`.

## References

- `README.md`
- `docs/CLI_REFERENCE.md`
- `docs/AGENT_GUIDE.md`
