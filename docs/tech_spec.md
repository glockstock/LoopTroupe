# Loop Troupe — Technical Spec

Owner: `engineering_manager` (sole editor; see AGENTS.md). Status as of 2026-10-02.

## Architecture (implemented)

A static single-page app with no build step, no framework, and no backend.

| File | Role |
| --- | --- |
| `index.html` | Shell: header/nav, `<main id="view">`, footer, modal and toast containers. Loads Google Fonts, `js/data.js`, then `js/app.js`. |
| `css/style.css` | All styling; shared values are CSS custom properties on `:root`. |
| `js/app.js` | One IIFE: data indexing, ride store, hash router, view renderers, isometric SVG scene generator, modal, toasts, backup. |
| `js/data.js` | `const COASTER_DB = { generated, parks: [...] }`. |

### Routing

Hash routes: `#/` (home), `#/parks?state=XX`, `#/park/<park-id>`, `#/coasters`, `#/credits`. Unknown routes render home.

### Coaster database

`COASTER_DB.parks[]`: `{ id, name, city, state, defunct?, coasters: [{ id, name }] }`. Park IDs are slugs; coaster IDs are `<park-id>--<coaster-slug>`. **IDs are a durable contract.** Ride logs are keyed by coaster ID, so an ID must never change or be reused. The September 2024 source scrape and the one-off build script are not in the repository; future edits are made directly in `js/data.js`.

### Ride-log storage

`localStorage['coaster-credits.v1']` = `{ version: 1, rides: { [coasterId]: { date: 'YYYY-MM-DD', rating: 0-5, review: string, count: int >= 1, loggedAt: epoch ms } } }`. A rating of 0 means unrated. Backups export the same `rides` object as JSON; import merges entries whose coaster IDs exist and skips unknown ones. Read failures fall back to an empty log.

### Rendering

Views render HTML strings into `#view`; all user-entered text passes through `esc()`. Isometric park scenes are generated SVG: a 2:1 isometric grass diamond with `<use>` references to shared pixel sprites, colored per coaster when ridden.

### Deployment

`.github/workflows/deploy.yml` runs on every push to `main`, force-pushing the tree (plus `.nojekyll`) to `gh-pages`, which GitHub Pages serves. Pushing to `main` is a production release.

## Constraints

- Keep the no-build, no-framework, no-backend architecture unless the user approves a change.
- Any change to the storage schema or coaster IDs needs a versioned migration that preserves existing credits.
- No analytics or transmission of ride data without user approval.
