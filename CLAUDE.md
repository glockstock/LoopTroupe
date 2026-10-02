# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md is the authoritative source for structure, ownership, routing, style, and deployment rules. Read it first; the notes below are a quick reference and Claude-specific additions.

## Commands

```sh
python3 -m http.server 8000   # serve the site → http://localhost:8000
```

No build step, no dependencies, no test suite. Pushing to `main` deploys the live site.

## Before frontend changes

Read `docs/design_guide.md` and reuse the tokens in `css/style.css`. See `docs/spec.md` (scope) and `docs/tech_spec.md` (architecture).

## Subagents

`.claude/agents/` contains Claude Code counterparts to every Codex specialist in `.codex/agents/` (kebab-case names; keep both copies aligned when a role changes). Where AGENTS.md says `product_designer`, use the `product-designer` subagent, and likewise for the other roles.

## Must-preserve boundaries

- Never change or reuse an existing coaster ID in `js/data.js`; riders' credits are stored under those IDs.
- Never change the `coaster-credits.v1` storage format without an approved migration.
- Escape user-entered text before rendering it.
