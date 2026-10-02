# Repository Guidelines

## Project Structure

Loop Troupe is "Goodreads for roller coasters": a static, local-first website where enthusiasts track their coaster credits, rate and review rides, and see progress by park and state. It is plain HTML, CSS, and JavaScript with no build step, no framework, and no backend.

- `index.html` — app shell (header, nav, footer, modal and toast containers).
- `css/style.css` — the entire design system: tokens and component styles.
- `js/app.js` — hash-routed single-page app: views, ride log, isometric scenes, backup.
- `js/data.js` — the park and coaster database (`COASTER_DB`).
- `docs/` — product spec, technical spec, design guide, and open questions.
- `.github/workflows/deploy.yml` — publishes `main` to the `gh-pages` branch.
- `.codex/agents/` — project-scoped Codex specialists; `.claude/agents/` holds their Claude Code counterparts.

Read `docs/spec.md` for product scope and `docs/tech_spec.md` for architecture. Read `docs/design_guide.md` before changing any UI, and reuse the tokens in `css/style.css`.

## Specialist Fleet

| Role | Owns |
| --- | --- |
| `product_manager` | Product vision, roadmap, priorities; sole editor of `docs/spec.md` |
| `engineering_manager` | Architecture and technical direction; sole editor of `docs/tech_spec.md` |
| `product_designer` | Flows, usability, accessibility, design language; steward of `docs/design_guide.md` |
| `art_director` | Visual direction, pixel-art and isometric craft, brand expression |
| `design_systems_engineer` | Tokens, reusable UI patterns, front-end consistency |
| `motion_ux_engineer` | Animation and microinteractions |
| `web_performance_engineer` | Load and runtime performance, fonts, payload |
| `ux_content_designer` | All website copy and terminology |
| `product_marketing_manager` | Positioning, messaging, README pitch, naming |
| `qa_engineer` | Independent functional testing and ride-data safety |
| `product_experience_reviewer` | Independent end-to-end journey reviews |
| `codebase_curator` | Repository structure, hygiene, documentation freshness |
| `coaster_data_curator` | Accuracy and integrity of `js/data.js`, including stable coaster IDs |

The user is the product owner and final authority. The primary agent coordinates delivery and delegation.

## Product Management and Spec Ownership

- Consult `product_manager` for product questions, priorities, requirements, and conflicts in direction.
- Only `product_manager` may edit `docs/spec.md`. Other agents read it and propose changes through it.
- When the user gives new product direction, involve `product_manager` in the same assignment, passing the user's actual words, so the spec records it. Honor explicit or reasonably implied approval without asking again; agent recommendations, implementation drift, and silence are not approval.
- Keep unresolved product and technical questions in `docs/open_questions.md` with stable IDs. Any agent may add or clarify questions; recording a proposal does not approve it.

## Engineering Management and Technical Spec Ownership

- Consult `engineering_manager` for architecture, storage contracts, deployment, and consequential technical decisions.
- Only `engineering_manager` may edit `docs/tech_spec.md`.
- Escalate big changes to the user with a recommendation, alternatives, and migration/rollback implications before adopting them. Big changes include adding a backend, accounts, or third-party services; adding a build system or framework; changing the ride-log storage schema or coaster ID scheme; and changing hosting.

## Design, Art Direction, and Content Routing

- Involve `product_designer` when UI work introduces or materially changes visual or interaction patterns, and have it review significant UI changes before completion. Keep reusable conventions and `docs/design_guide.md` aligned in the same work.
- Involve `art_director` for substantial visual redesigns and visual-craft review. It leads visual direction; `product_designer` integrates it into usable flows and the guide.
- The approved direction is a retro, late-1990s theme-park-tycoon simulation feel: pixel type, beveled windows, grass and sky, isometric pixel dioramas, whimsy. Evoke the genre; never copy a specific game's sprites, interface art, logos, or trademarked names, and never imply affiliation. Obtain user approval of representative screens before replacing this direction; polish within it needs no repeated approval.
- Involve `ux_content_designer` for substantive copy. `product_marketing_manager` owns positioning and external narrative.
- Trivial UI changes that apply an established pattern do not require delegation.

## Data Routing

- Involve `coaster_data_curator` for any change to `js/data.js`.
- Coaster IDs (`park-slug--coaster-slug`) are the keys riders' credits are stored under. Never change or reuse an existing ID; fix display names instead. Any ID change requires an `engineering_manager`-approved migration.

## QA and Experience Review Routing

- Involve `qa_engineer` for meaningful behavior changes and bug fixes, especially anything touching ride logs, `localStorage`, import/export, routing, or coaster IDs. Require evidence and an explicit passed/failed/blocked/not-run summary.
- Involve `product_experience_reviewer` for important rider journeys or substantial workflow changes. Review findings do not authorize implementation or spec changes.

## Codebase Curator Routing

- Involve `codebase_curator` whenever work adds files or directories, for structural changes, and for cleanup. Batch related additions into one review.
- Keep `.codex/agents/` and `.claude/agents/` counterparts aligned when a role changes.
- Check `README.md` whenever structure, commands, or workflows change.

## Development

No dependencies or build step. Serve the repository root with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

For UI changes, check desktop and a 390px mobile width, keyboard navigation, and the log-ride modal. There is no automated test suite yet; describe the checks you ran.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which publishes the repository to the `gh-pages` branch. The live site is https://glockstock.github.io/LoopTroupe/. Treat a push to `main` as a production release.

## Coding Style

Match existing code: two-space indentation, camelCase, semicolons, single quotes in JavaScript; CSS custom properties for shared values. Use semantic HTML, visible labels, and keyboard-accessible controls. Escape all user-entered text (reviews) before rendering. No formatter or linter is configured; avoid unrelated formatting changes.

## Commits

Use short, specific, imperative subjects (for example, `Add Epic Universe coasters`). Keep commits focused. Include screenshots in PRs for visible UI changes.

## Privacy

Ride logs live only in the rider's browser (`localStorage` key `coaster-credits.v1`) and in backup files they export. Do not add analytics, tracking, or any transmission of ride data without explicit user approval.
