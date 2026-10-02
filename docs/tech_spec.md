# Loop Troupe — Technical Spec

Owner: `engineering_manager` (sole editor; see AGENTS.md). Status as of 2026-10-02.

## Architecture (implemented)

A static single-page app with no build step, no framework, and no backend.

| File | Role |
| --- | --- |
| `index.html` | Shell: header/nav, `<main id="view">`, footer, modal and toast containers. Loads Google Fonts, `js/data.js`, `js/guides/index.js`, then `js/app.js`. |
| `css/style.css` | All styling; shared values are CSS custom properties on `:root`. |
| `js/app.js` | One IIFE: data indexing, ride store, hash router, view renderers (including park guides), isometric SVG scene generator, modal, toasts, backup. |
| `js/data.js` | `const COASTER_DB = { generated, parks: [...] }`. |
| `js/guides/` | Park guide manifest (`index.js`, always loaded) and one content file per guide (lazy-loaded); see "Park guides". |
| `scripts/check-guides.mjs` | Node validator for guide content (`node scripts/check-guides.mjs`); runs in the deploy workflow. |

Planned files for real park maps, ride pages, and ride stats are listed under "Real park maps, ride pages, and ride stats".

### Routing

Hash routes: `#/` (home), `#/parks?state=XX`, `#/park/<park-id>`, `#/guide/<park-id>[/<section-id>]` (see "Park guides"), `#/coasters`, `#/credits`. Unknown routes render home. Planned: `#/coaster/<coaster-id>` (see "Ride pages").

### Coaster database

`COASTER_DB.parks[]`: `{ id, name, city, state, defunct?, coasters: [{ id, name }] }`. Park IDs are slugs; coaster IDs are `<park-id>--<coaster-slug>`. **IDs are a durable contract.** Ride logs are keyed by coaster ID, so an ID must never change or be reused. The September 2024 source scrape and the one-off build script are not in the repository; future edits are made directly in `js/data.js`.

### Ride-log storage

`localStorage['coaster-credits.v1']` = `{ version: 1, rides: { [coasterId]: { date: 'YYYY-MM-DD', rating: 0-5, review: string, count: int >= 1, loggedAt: epoch ms } } }`. A rating of 0 means unrated. Backups export the same `rides` object as JSON; import merges entries whose coaster IDs exist and skips unknown ones. Read failures fall back to an empty log.

### Rendering

Views render HTML strings into `#view`; all user-entered text passes through `esc()`. Isometric park scenes are generated SVG: a 2:1 isometric grass diamond with `<use>` references to shared pixel sprites, colored per coaster when ridden.

### Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: it runs `node scripts/check-guides.mjs` (a failure stops the deploy), then force-pushes the whole tree (plus `.nojekyll`) to `gh-pages`, which GitHub Pages serves. Pushing to `main` is a production release. Approved change: publish an allowlist instead of the whole tree (see "Deploy hygiene").

## Park guides (approved; implemented, Cedar Point guide unpublished)

**Approved by the owner on 2026-10-02:** the first park guide is Cedar Point, built as a mobile web guide inside this static site. Guide content lives in the public repository for now ("I don't care that the GH is public for now"). No paywall, checkout, accounts, or analytics yet. The no-build, no-framework, no-backend architecture stays. `docs/proposals/accounts-and-payments.md` remains a proposal for later. Product requirements: `docs/guides/cedar-point-brief.md`.

**State today (commit `17225fc`):** implemented as specified below. `index.html` loads the manifest, `js/app.js` renders `#/guide/...` routes with lazy loading and `?preview` gating, and the deploy workflow runs the validator. The Cedar Point guide (`js/guides/cedar-point.js`) is a draft with `published: false`, waiting on the owner's team to verify it.

### Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Routes `#/guide/<park-id>` and `#/guide/<park-id>/<section-id>`; one guide per park, keyed by park ID. | Fits the existing `parts[]` router; every section gets a shareable link; the park ID is already a durable key. |
| 2 | Content is a plain-JS data file per guide, `js/guides/<park-id>.js`, registering `window.GUIDES['<park-id>']`. A tiny always-loaded manifest, `js/guides/index.js`, defines `window.GUIDE_INDEX` with each guide's `src` and `published` flag. | Same pattern as `js/data.js`: no build, works on any static server, comments allowed for writers. Writers edit data, never app code; publishing is a separate one-line switch. |
| 3 | Prose is plain strings. The renderer escapes everything, then allows only `**bold**` and `[label](https://…)` links. No HTML. | A small, explicit allowlist; escaping first means guide text can never inject markup. |
| 4 | Lazy-load the guide file only on guide routes; the manifest (under 1 KB) always loads. | `js/data.js` is already 135 KB; a 4,000–7,000-word guide adds roughly 40–80 KB that the home and park pages never need. |
| 5 | Every claim carries `status` and `lastVerified`. Drafts are never shown to regular visitors: an unpublished guide renders only with `?preview` in the hash, and a published guide must have zero draft claims (validator) and hides any it finds (renderer). Needs-check claims may go live, always labeled "Unconfirmed." Verified-looking states are computed from claims, never trusted from a flag. | Meets the brief's hard rule ("never goes live with draft claims") with a guard in two places, while letting a published guide age into needs-check without being pulled. |
| 6 | No service worker in the first build (Q-021). The guide meets the brief's minimum (an open tab keeps working with no signal); full "open at home, read in the park" offline is a separate, small follow-up before go-live. | Every push to `main` is a production release; a service-worker caching mistake can strand riders on a stale or broken `app.js`. Worth doing, but on its own with its own QA, after the guide UI is stable. |
| 7 | `scripts/check-guides.mjs` (Node 18+, built-ins only) validates every guide against the schema and `js/data.js`. | Catches broken coaster IDs, missing statuses, and premature publishing before they ship. |
| 8 | The guide's `credits.operating` list is the authority for which coasters are ridable this season (answers Q-029 for now). | `js/data.js` lists retired coasters with no per-coaster flag. A future additive `closed` field in `js/data.js` (no ID changes) would let the validator cross-check; that is `coaster_data_curator`'s call. |

### Routing and entry points

- `route()` gains `page === 'guide' && parts[1]` → `renderGuide(parts[1], parts[2], params)`. The nav highlights **Parks** on guide routes (a guide is a park sub-page).
- **Unpublished** (`GUIDE_INDEX[id].published === false`): without `preview` in the hash query, show a short "This guide isn't out yet" state linking to the park page, and do not load the guide file. With `#/guide/<id>?preview` (or `#/guide/<id>/<section>?preview`), render everything with draft badges under a draft-preview banner. In-guide links keep the `?preview` flag. Because every push to `main` is a release, this keeps drafts off the live site for regular visitors; the content is still readable in the public repository, which the owner accepted.
- Unknown park ID or no manifest entry: a "Guide not found" state linking to `#/park/<id>` if the park exists, else `#/parks`. Unknown section ID: render the guide from the top.
- Section anchors are `id="g-<section-id>"`. After render, scroll the section into view and focus its heading (`tabindex="-1"`), because `route()` scrolls to the top first. The jump menu links to `#/guide/<park-id>/<section-id>`. If that guide is already rendered, scroll only (do not re-render), so an open video keeps playing.
- Park page: when `GUIDE_INDEX[park.id]?.published` is true, show a "Park guide" card linking to `#/guide/<park-id>`. The guide links back to `#/park/<park-id>`.
- Top nav: no "Guides" item while only one guide exists. Add `#/guides` (an index) when a second guide ships.
- `index.html` loads `js/guides/index.js` after `js/data.js` and before `js/app.js`. `app.js` must tolerate a missing manifest (`window.GUIDE_INDEX || {}`).

### Loading

- `loadGuide(parkId)` injects `<script src="<GUIDE_INDEX[id].src>">` once and caches the promise. On `onerror`, remove the tag and clear the cached promise so **Retry** works.
- While loading, show a small loading state. On failure: "Couldn't load the guide. Check your signal and try again," with a Retry button.
- When the script resolves, render only if `location.hash` still points at that guide (the rider may have navigated away).
- After loading, require `window.GUIDES[id]?.schema === 1`; otherwise show the failure state rather than guessing.
- After the first render, the guide needs no network: all text is in the one file, ride logging uses `localStorage`, and videos load only on tap. GitHub Pages caches files for about 10 minutes, so content edits can take that long to appear; no cache-busting for now.

### Content schema (v1)

`js/guides/index.js`:

```js
window.GUIDE_INDEX = {
  'cedar-point': { src: 'js/guides/cedar-point.js', published: false },
};
```

`js/guides/<park-id>.js` (plain data only: strings, numbers, booleans, null, arrays, objects):

```js
window.GUIDES = window.GUIDES || {};
window.GUIDES['cedar-point'] = {
  schema: 1,
  parkId: 'cedar-point',     // equals the manifest key and a park ID in js/data.js
  title: 'Cedar Point',
  season: 2027,
  staleBefore: null,          // 'YYYY-MM-DD': verified claims checked earlier count as needs-check
  credits: {                  // a claim: the operating list is a fact to verify
    id: 'credits-operating', operating: ['cedar-point--steel-vengeance', /* … */],
    text, kind, volatility, status, lastVerified,
  },
  sections: [{
    id: 'at-a-glance', title: 'At a glance',
    status, lastVerified, verifiedBy,   // the section sign-off
    answer: { /* claim: the one-line answer, 25 words or fewer */ },
    blocks: [ /* blocks */ ],
  }, /* … */],
  changelog: [{ date: 'YYYY-MM-DD', text }],  // newest first; not claims
};
```

**Claim** (any object with `text`); fields follow the brief's verification record:

| Field | Rule |
| --- | --- |
| `id` | Required. Lowercase-hyphen slug, unique within the guide, never reused. |
| `text` | Required. Inline markup only (`**bold**`, `[label](https://…)`). |
| `kind` | `'fact' \| 'take' \| 'estimate'`. Required once past draft. |
| `volatility` | `'stable' \| 'seasonal' \| 'volatile'`. Required once past draft. |
| `status` | Required: `'draft' \| 'needs-check' \| 'verified'`. Only the team sets `verified`. |
| `lastVerified` | `'YYYY-MM-DD'` of the visit or check that confirmed it, or `null`. Required when verified; never in the future. |
| `verifiedBy`, `basis` | Required when verified: who confirmed it (credited per Q-028) and on what basis (team note with date, visit date, or official URL). |
| `sources` | Optional array of research links. Internal; never rendered. |

The section a claim belongs to is its position in the file. **Effective status** is `status`, except that a verified claim whose `lastVerified` is before `staleBefore` counts as needs-check (the brief's "automatically needs check when a new season starts"); set `staleBefore` to opening day each season.

**Blocks** (every item in a block's list is a claim; `title` is an optional sub-heading on list-type blocks):

| `type` | Shape | Use |
| --- | --- | --- |
| `p` | the block is a claim; optional `tone: 'tip' \| 'warning'` | Prose paragraph or callout |
| `list` | `title?`, `ordered?`, `items: [claim]` | Bullets or numbered lists |
| `facts` | `title?`, `items: [{ label, …claim }]` | Label/value rows (at a glance) |
| `picks` | `title?`, `kind: 'gate' \| 'food' \| 'other'`, `items: [{ name, location?, bestFor?, …claim }]` | Gates, food spots |
| `rides` | `title?`, `ranked?`, `items: [{ coasterId, label?, …claim }]` | Must-rides and tiers (one block per tier), and ride-by-ride notes (several items per coaster, grouped by `coasterId` in first-appearance order) |
| `plan` | `id`, `title`, `steps: [{ coasterId?, time?, …claim }]` | Ride-order plans; a step without `coasterId` is a non-ride step; `time` is a label, shown as an estimate when `kind` is `estimate` |
| `videos` | `title?`, `items: [{ title, creator, creatorUrl?, videoId? \| url?, coasterId?, …claim }]` | `videoId` is an 11-character YouTube ID (tap-to-load embed); `url` is any https link (link only) |
| `credits` | `show: 'summary' \| 'checklist'`, at most one of each | `summary`: "You've ridden X of Y operating coasters here" plus those still to ride. `checklist`: every operating coaster with ridden toggles |

Section IDs, in order: `at-a-glance`, `when-to-go`, `getting-in`, `must-rides`, `ride-plans`, `ride-notes`, `food`, `videos`, `freshness`. The renderer adds the per-section sign-off table and the changelog to `freshness`.

**Coaster references** are only stable coaster IDs from `js/data.js`, and they must belong to the guide's park. Park coasters missing from `credits.operating` are treated as retired and may appear only in a short "legacy credits" note. Rebuilt rides follow the database (Top Thrill 2 and Steel Vengeance are separate IDs from Top Thrill Dragster and Mean Streak); the guide makes no ruling on credit conventions (Q-002).

**Schema changes:** additive optional fields keep `schema: 1`. A breaking change bumps `schema`, and the guide files are migrated in the same commit (they live in the repo, so readers need no migration). The guide never writes to storage except through the existing ride-log functions; `coaster-credits.v1` is unchanged.

### Rendering rules (for the implementer)

- **Escaping.** Claim `text`: `esc()` first, then exactly two replacements on the escaped string: `/\*\*(.+?)\*\*/g` → `<strong>$1</strong>`, and `/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g` → `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`. Every other string (`title`, `label`, `name`, `location`, `bestFor`, `creator`, `time`) is `esc()` only, with no markup. Attribute URLs (`url`, `creatorUrl`) must match `^https://` at runtime before `esc()` into the attribute; otherwise render no link. `videoId` must match `^[A-Za-z0-9_-]{11}$` at runtime before it reaches an iframe `src`. Never put unescaped guide data into `innerHTML`.
- **Draft claims.** Published guide: skip any claim whose effective status is `draft` (defense in depth; the validator already forbids them). Preview: show them with a "Draft" text badge.
- **Needs-check claims** (including stale ones): always shown with a visible "Unconfirmed" label and the brief's wording ("We haven't tried this yet: check before you go"), styled so they can't pass for fact. Text, not color alone.
- **Estimates and takes.** Claims with `kind: 'estimate'` get an "Estimate" label (plan times included). Takes need no label; the voice carries them.
- **Sections.** Show "Last verified <date>" using the oldest `lastVerified` among the section's verified claims. If the section's `answer` is needs-check, show a short notice at the top of the section.
- **Preview banner.** In preview, a persistent banner: draft preview, not yet verified by the team, "k of n details checked."
- **Credits.** `need = credits.operating.filter(id => !rides[id])`. Rows reuse `coasterRow(id)` and `bindRows()` so riders log from the guide with the same toggle and modal; `redrawCurrent()` needs a `guideRedraw` like `parkRedraw`. Plan steps and ride-note groups with a `coasterId` show a "New credit" badge when the coaster is not in `rides`, and use the display name from `coasterById`. Empty log: invite, don't scold. The park page's count (every coaster in `js/data.js`) and the guide's (operating only) differ; label the guide's "operating."
- **Videos.** Render a card with the title, "by <creator>" (linked when `creatorUrl` is valid), the reason (`text`), and a "Play video" button. Only on tap, replace it with an iframe to `https://www.youtube-nocookie.com/embed/<videoId>` with a `title` attribute. No thumbnails, so nothing is requested from YouTube until the rider asks. `url` picks render as an external link.

### Offline (Q-021): recommendation

Not in the first build. The guide arrives as one script and renders all sections at once, so a guide already open in a tab keeps working with no signal (the brief's minimum): ride logging is local, and videos are tap-to-load. Full offline ("opened once at home, readable in the park after a reload") needs a service worker, which carries real risk here because every push to `main` is a production release and a caching bug can strand riders on a stale or broken `app.js` until they clear site data. Plan it as a separate, small change after the guide UI is stable and before go-live: network-first for HTML and JS with cache fallback, guide files cached only after a guide is opened, a versioned cache name, and a ready kill-switch release that unregisters the worker; `qa_engineer` tests deploy-over-deploy updates. Copyability (Q-021's original concern) is moot while guide content is public in the repo; it returns with any paywall.

### Validation

`node scripts/check-guides.mjs` (Node 18+, no dependencies). It loads `js/data.js`, the manifest, and each guide in a `vm` sandbox, then exits 1 on any error. Run it before committing any change to `js/guides/` or `js/data.js` (a coaster ID change would break a guide too).

- **Errors:** guide not registered, or `parkId` mismatch; a file that fails to parse (with the line); non-plain data; unknown block type; a claim without a valid `id` (or a duplicate), `text`, or `status`; `kind`/`volatility` missing or invalid past draft; a verified claim without `lastVerified`, `verifiedBy`, or `basis`; a future or malformed date; placeholder text in a non-draft claim; a coaster ID not in `js/data.js` or from another park; duplicates in `credits.operating`; duplicate section or plan IDs; a section without an `answer`; non-https links; an invalid YouTube ID, or both `videoId` and `url`; a signed-off section that still has draft claims, or lacks `verifiedBy`/`lastVerified`; more than one credits block of a kind; and, when `published: true`, any draft claim, a draft operating list, or any section not signed off.
- **Warnings:** unknown fields (typos), HTML-looking text, unbalanced `**`, answer lines over 25 words, missing recommended sections or credits blocks, a must-ride, plan, or note coaster not in `credits.operating`, an incomplete draft video pick, an out-of-order changelog, and guide files missing from the manifest.
- **Summary:** per guide, claims by effective status (% verified, stale count), placeholders left, park coasters treated as retired, and operating coasters without ride notes.

`.github/workflows/deploy.yml` runs this command before publishing, so a broken guide cannot ship.

### Content in a public repository

Accepted by the owner for now. Anything committed stays in public git history even if guide content later moves behind a paywall, so a future paid edition should be treated as new writing rather than relying on removing the free version (see Q-020). `verifiedBy` names are public too; use the credit the team agrees to (Q-028).

## Real park maps, ride pages, and ride stats (approved plan; not implemented)

**Approved by the owner on 2026-10-02:**

1. **Real maps.** Real OpenStreetMap layouts on park pages, Cedar Point first and polished to ship quality, then the other four pilot parks (Kings Island, Dollywood, Six Flags Magic Mountain, Knoebels) one at a time. Every other park keeps today's procedural diorama. Map data is published under the ODbL with "© OpenStreetMap contributors" on every map (Q-035, Q-037).
2. **Ride pages: pixel art now, a 3D trial later.** Each coaster gets a ride page with a pixel-art zoom-in that matches the maps. A voxel or low-poly 3D trial comes later; no 3D library now (Q-012).
3. **Stats from Wikidata (CC0) plus Wikipedia infoboxes (CC BY-SA).** Ride pages credit Wikipedia, the stats file is offered under CC BY-SA, and missing values show as missing (Q-036).

The no-build, no-framework, no-backend architecture stays. Product requirements: `docs/spec.md` C1a and C1b. Evidence: the map spike (`spikes/osm-park-map/` on branch `spike/osm-park-map`) and the stats spike (`spikes/coaster-stats/` on branch `spike/coaster-stats`). Neither spike branch is merged as is; see "Sequencing".

**What does not change:** the ride-log storage schema (`coaster-credits.v1`), coaster IDs, backups, and `js/data.js`. No migration is needed. Maps, ride pages, and stats only read the ride log, and they write to it only through the app's existing logging functions.

### Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | An offline Node script (built-ins only, run by a person) turns OSM extracts plus curated links and overrides into one small, precomputed map file per park: `js/maps/<park-id>.json`. | Riders download about 60 KB gzipped instead of a 3.2 MB raw extract, and phones skip the model build (220 ms on a desktop in Node for Cedar Point, around a second on a mid-range phone). No site build step: the output is committed like `js/data.js`. |
| 2 | Raw OSM extracts are **not committed**. They live in a gitignored local cache (`sources/maps/raw/`). The curated links and overrides that feed the build **are** committed (`sources/maps/`). | 6.6 MB for five parks grows to hundreds of MB for 298 parks, and git history keeps every version forever. The site never needs raw data. ODbL §4.6 is met by publishing the derived database itself (the map files) together with the recipe (script plus inputs). |
| 3 | Generated data is JSON; hand-edited data is JS. Map files and the stats file are JSON. Guides and manifests stay JS. | Generated files need no comments; `JSON.parse` is faster than parsing large JS literals; Node validators read JSON directly. Writers keep comments where they edit by hand. |
| 4 | Licenses never mix within a file. ODbL map data stays in `js/maps/` and `sources/maps/`, CC BY-SA stats stay in `js/stats.json`, and `js/data.js` takes neither. Map art heights never come from Wikipedia; the stats file never takes OSM values. | Keeps share-alike obligations confined to the files that carry them (the OSMF horizontal-layer pattern), and keeps the coaster database free of both. ODbL and CC BY-SA cannot be combined into one database. |
| 5 | The renderer is ported from the spike as ES modules in `js/parkmap/` (`.js` extension), loaded on demand with dynamic `import()` from the classic `app.js`. | The spike is already modules, so the port is low-risk; modules keep their own scope (no new globals); every browser that runs today's `app.js` (it uses optional chaining) supports module scripts and `import()`; `.js` gets a JavaScript MIME type from every static server. |
| 6 | A tiny always-loaded manifest, `js/maps/index.js` (`window.MAP_INDEX`), decides which parks have a real map, with the guides' `published` and `?preview` semantics. Everything else keeps the diorama. | The same proven pattern as `GUIDE_INDEX`. Publishing or rolling back a map is a one-line change. |
| 7 | The map gets read-only access to the ride log through functions the app passes in. It never touches `localStorage`. | One writer (the app) means no second code path can corrupt credits. The spike read `localStorage` directly; the site version must not. |
| 8 | Panning blits cached tiles. Rasterizing happens only when the zoom, rotation, or a coaster's ridden state changes, and in time-sliced tiles. | The spike re-rasterizes the whole view on every pan (30–90 ms per frame at Cedar Point, 12–25 fps). Tiles bring panning down to copying a few bitmaps. |
| 9 | Ride pages at `#/coaster/<coaster-id>`, for every coaster in `js/data.js`, reuse `coasterRow`, `bindRows`, and the log dialog. | Logging on a ride page then behaves exactly as everywhere else, with no new storage code. |
| 10 | The ride page vignette reuses the map renderer, framed on the coaster, when the park has a published map and the coaster is on it. Otherwise it shows today's procedural sprite, enlarged and animated. | One renderer and one art language, and the owner's "zoom in from the map" continuity, with no second art pipeline. |
| 11 | Stats live in one file, `js/stats.json`, keyed by coaster ID, with per-field provenance. They are lazy-loaded on the first ride page. | One file serves ride pages now and the stats view (C3, wood vs. steel and manufacturer) later. Provenance on every field makes attribution and audits mechanical. |
| 12 | The deploy publishes an **allowlist** (`index.html`, `css/`, `js/`, `.nojekyll`) as a fresh orphan commit. | Spikes, docs, agent configs, scripts, and pipeline inputs stop being served as website pages. A new folder must be published on purpose, never by accident. |
| 13 | A new validator, `scripts/check-data.mjs`, checks map files, the map manifest, and the stats file against `js/data.js`, licenses, and budgets. It runs in the deploy workflow. | Broken coaster links, missing provenance, a missing license notice, or a budget overrun cannot ship. |

### Planned files

| Path | Published | What |
| --- | --- | --- |
| `js/maps/index.js` | yes | `window.MAP_INDEX`: always loaded, under 1 KB. |
| `js/maps/<park-id>.json` | yes | One park's map data (ODbL). |
| `js/maps/LICENSE.md` | yes | ODbL notice for the folder (text as in the spike's `data/LICENSE.md`, adapted). |
| `js/parkmap/park-map.js`, `raster.js`, `decode.js`, `tiles.js` | yes | Renderer modules ported from the spike's `map.mjs` and `raster.mjs`, plus the track-profile functions from `model.mjs`. |
| `js/stats.json` | yes | Ride stats (CC BY-SA 4.0). |
| `scripts/maps/fetch.mjs` | no | Network fetcher (port of the spike's `fetch.mjs`) → `sources/maps/raw/<park-id>.json`. |
| `scripts/maps/build.mjs` | no | Offline build (port of `model.mjs` plus simplification and encoding) → `js/maps/<park-id>.json`. |
| `sources/maps/parks.json`, `<park-id>.links.json`, `<park-id>.overrides.json`, `LICENSE.md` | no | Curated build inputs (ODbL), moved from the spike's `parks.json` and `data/*.links.json` / `*.overrides.json`. |
| `scripts/stats/build.mjs`, `sources/stats/links.json`, `sources/stats/overrides.json` | no | Stats pipeline and curated inputs (owned by `coaster_data_curator`; contract below). |
| `sources/maps/raw/`, `sources/stats/raw/` | no (gitignored) | Local caches of raw OSM, Wikidata, and Wikipedia responses. |
| `scripts/check-data.mjs` | no | Validator (see "Validation"). |

Directory names are subject to `codebase_curator` review; the contracts below do not depend on them.

### Map data pipeline

**Fetching (answers Q-034 for the pilot; the bulk path stays open).** These scripts run by hand on a person's machine, never in CI and never from riders' browsers.

- **Default: Overpass** (`fetch.mjs <park-id>`). Two queries per park: find the `tourism=theme_park` outline by name near a point, then everything in its bbox plus 120 m, using the spike's `wanted()` filter. Requests are sequential, at least 10 s apart, with the User-Agent `LoopTroupe-maps/<version> (https://github.com/glockstock/LoopTroupe)`. The script checks `/api/status` for a free slot first, stops on 429 or 504, and never retries in a loop. Five pilot parks a season is a few dozen requests a year, far below the fair-use limits (about 10,000 queries and 1 GB a day).
- **Fallback: the main OSM API** (`--source osm-api`), only when Overpass is unreachable from the machine running the script, and only for a handful of identified requests: one `map.json` bbox request per park (well under 0.25 square degrees and 50,000 nodes), at most 10 per session, at least 6 s apart, with the same User-Agent, stopping on 429 or 509. This is the spike's behavior, kept as a narrow exception because the editing API is not for bulk reads.
- **Bulk (C1c, all 298 parks):** not decided. Recommended: Geofabrik US state extracts downloaded once per season and cut per park offline. That needs either a small PBF reader written on Node built-ins or `osmium-tool` as a person-run tool (not a site dependency). Decide before C1c (open question T-1).
- Fetched files drop all editing metadata (user names, uids, changesets, timestamps), as the spike does. Each raw file records its endpoint, bbox, fetch time, and the OSM data timestamp (`osm3s.timestamp_osm_base` from Overpass).
- **Refresh:** at least once a season per mapped park, and after a park opens or removes a coaster. A refresh is fetch, then build, then check, reviewed as an ordinary commit with a visual check of the map.

**Building** (`build.mjs <park-id>`: offline, deterministic, no network). The spike's `buildPark()` runs in Node against the cached raw file plus `sources/maps/<park-id>.links.json` and `.overrides.json`, then simplifies and encodes the result:

- **Local frame:** meters, x east and y north, equirectangular around the park outline's center (the spike's projection). The origin `[lat, lon]` is recorded.
- **Quantization:** integers in units of `q = 0.5` m, which matches the closest zoom level (0.5 m per sub-unit), so nothing visible is lost. Measured on Cedar Point, 0.25 m costs 7% more and 1 m saves only 6%.
- **Encoding:** every ring or line is a flat array of delta-encoded integers `[x0, y0, dx1, dy1, …]`. Repeated strings (path kinds, building kinds) become indexes into small enum tables.
- **Precomputed offline, not in the browser:** coaster assembly and direction, curator links, `notCoaster` drops, merged tracks, spur detection, the gate, and open water. The spike's flood-filled water grid becomes closed polygons, with partial shorelines closed along the region edge on the water side.
- **Kept per layer** (Douglas–Peucker tolerance; minimum size):

| Layer | Kept | Tolerance |
| --- | --- | --- |
| Coaster track (linked and unlinked) | all track, `closed`, station position, art-peak inputs | 0.25 m |
| Spur and storage track | as flat track | 0.5 m |
| Park outline, rails | geometry | 0.5 m |
| Buildings | ring, rounded height in m, kind enum, inside-park flag. Names dropped. Skip below 8 m². | 0.75 m |
| Footpaths and plazas | line or ring, width (0.5 m steps), kind enum, bridge flag | 1 m |
| Roads, parking, sand, water | geometry, road class | 1–1.5 m |
| Grass and gardens; woods | geometry. Skip below 40 m². Wood trees are generated at runtime from a seeded hash, as in the spike. | 2.5 m; 3 m |
| Single trees, attractions | points; attraction kind (names kept only for attractions) | — |

- **Dropped:** anything outside the drawn region (the outline's bounds plus 220 m), untagged geometry, every OSM tag except the few mapped to enums, OSM element IDs (traceability lives in the committed links file), and all mapper metadata.
- **Art heights** (decorative, never shown as ride data): the peak comes from an override, an OSM `height` tag, or the spike's estimate. An override's source must be the team, OSM, or Wikidata (CC0), **never Wikipedia** (decision 4). The browser computes the track profile from `{ peak, profile: 'circuit' | 'launch', stationAt }`, so the 2 m height samples are not shipped.

**Size budget per park file:** at most **200 KB uncompressed and 64 KB gzipped** (validator error), with a target of 150 KB and 48 KB (validator warning). GitHub Pages serves JSON gzipped. Measured with a first-pass encoder on the spike data, before water baking and any per-park tuning: Cedar Point 180 KB / 57 KB, Kings Island 121 KB / 40 KB, Six Flags Magic Mountain 67 KB / 22 KB, Dollywood 41 KB / 14 KB, Knoebels 28 KB / 10 KB. Cedar Point is the largest pilot park. Its biggest layers are grass polygons (49 KB), buildings (45 KB), and paths (37 KB), so if it runs over budget, coarser grass and path tolerances are the first lever, before anything that changes the art.

**Map file schema (v1)** (`js/maps/<park-id>.json`):

```json
{
  "schema": 1,
  "parkId": "cedar-point",
  "license": "ODbL-1.0",
  "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
  "attribution": "© OpenStreetMap contributors",
  "attributionUrl": "https://www.openstreetmap.org/copyright",
  "notice": "Contains OpenStreetMap data © OpenStreetMap contributors, with Loop Troupe's curated changes. Available under the Open Database License 1.0.",
  "source": { "via": "overpass", "bbox": [41.475, -82.6975, 41.491, -82.6715], "osmBase": "2026-10-02T21:59:00Z", "fetched": "2026-10-02", "built": "2026-10-05" },
  "origin": [41.48395, -82.68591],
  "q": 0.5,
  "region": [0, 0, 0, 0],
  "view": { "rot": 1, "center": [0, 0], "m": 4 },
  "enums": { "path": ["footway", "path", "…"], "building": ["yes", "retail", "…"] },
  "layers": { "outline": [], "water": [], "woods": [], "greens": [], "sand": [], "parking": [], "plazas": [], "buildings": [], "paths": [], "roads": [], "rails": [], "trees": [], "attractions": [], "aux": [] },
  "gate": [0, 0],
  "coasters": [
    { "coasterId": "cedar-point--millennium-force", "link": "confirmed", "wooden": false,
      "tracks": [{ "pts": [0, 0, 3, -1], "closed": true, "stationAt": 0.02, "peak": 94.5, "peakFrom": "team", "profile": "circuit" }] },
    { "coasterId": null, "name": "Unnamed coaster 1", "tracks": [] },
    { "coasterId": "cedar-point--example", "link": "confirmed", "pin": [0, 0], "tracks": [] }
  ],
  "absent": { "cedar-point--mean-streak": "retired", "cedar-point--wild-mouse": "unmapped" }
}
```

- `coasterId` links only through the curated links file, never runtime name matching. `link` is `confirmed` or `inferred`. A coaster with no track but a known spot has a `pin` and is drawn as a signpost. `name` appears only for unlinked coasters (the app shows names from `js/data.js` for linked ones). The app escapes every string from a map file.
- `absent` accounts for every coaster of the park in `js/data.js` that is not on the map: `retired`, `unmapped` (operating but not in OSM yet), or `indoor`. Together, `coasters` and `absent` cover the park's whole list (spec C1b: "the map never hides a credit"). The page lists `unmapped` and `indoor` coasters as "not on the map yet".
- `view` is the hand-tuned default view (`art_director`), set in the overrides file and copied through by the build.
- **Schema changes:** additive optional fields keep `schema: 1`. A breaking change bumps it, and the renderer and every map file change in the same commit.

**ODbL notice and attribution placement:**

- In every published map file: the `license`, `licenseUrl`, `attribution`, and `notice` fields (ODbL §4.2: the notice travels with the data).
- `js/maps/LICENSE.md` and `sources/maps/LICENSE.md` for the folders.
- On screen: "Map data © OpenStreetMap contributors", linked to https://www.openstreetmap.org/copyright, in a strip directly under every map, at every width. The same credit goes on ride page vignettes drawn from map data, and on any shared image that includes a map (C5). The app supplies the text, and the validator checks that the file's `attribution` matches it.
- In `README.md`: a short "Data licenses" section (OSM/ODbL for `js/maps/`, CC BY-SA for `js/stats.json`, CC0 Wikidata credit), maintained by `codebase_curator`.

### Renderer integration

**Loading.** `index.html` loads `js/maps/index.js` after `js/guides/index.js`, and `app.js` tolerates its absence (`window.MAP_INDEX || {}`). The manifest:

```js
window.MAP_INDEX = {
  'cedar-point': { src: 'js/maps/cedar-point.json', published: false },
};
```

- `renderPark` shows the real map when `MAP_INDEX[id]?.published === true`, or with `#/park/<id>?preview` for unpublished maps. Otherwise it renders today's diorama, and nothing is downloaded.
- `loadParkMap(id)` starts two requests in parallel: `import(new URL('js/parkmap/park-map.js', document.baseURI).href)` and `fetch(src)` then `.json()`. The promise is cached per park and cleared on failure so Retry works (the `loadGuide` pattern). The absolute URL avoids any doubt about how `import()` resolves relative paths from a classic script.
- The map area reserves its final height from the first paint, so nothing shifts, and shows a "Loading map…" placeholder. On success, the canvas map replaces it. On failure, or when the module's `API !== 1` or the file's `schema !== 1`, the diorama is drawn instead, with a small "Couldn't load the map" note and Retry. The diorama is never shown as a stand-in while loading, because it must never pass for the real layout.
- The rest of the park page (header, progress, coaster list) renders immediately and never waits for the map, so logging stays one tap.
- Because GitHub Pages caches files for about 10 minutes, `app.js` and the renderer can briefly be from different deploys. The `API` and `schema` checks turn any mismatch into the diorama fallback rather than an error.

**Module API** (`js/parkmap/park-map.js`):

```js
export const API = 1;
export function mountParkMap(frame, data, {
  isRidden,        // (coasterId) => boolean, read-only view of the app's ride log
  colorOf,         // (coasterId) => '#rrggbb', the app's existing colorOf map
  nameOf,          // (coasterId) => display name from js/data.js
  reducedMotion,   // boolean
  onSelect,        // (coasterId | null) => void; the app renders the plaque and the ride-page link
}) { /* returns { refresh(), select(coasterId), destroy() } */ }
export function mountVignette(frame, data, coasterId, options) { /* non-interactive, framed on one coaster */ }
```

- **Ride-log sharing.** The app passes `isRidden: id => !!rides[id]`, so the map always sees the current log without its own copy. After any log change, `redrawCurrent()` calls `mapCtx.refresh()`, which re-styles only the coasters whose ridden state changed and invalidates only the tiles that contain them (each tile records the coaster IDs it drew).
- **Lifecycle.** Today `parkRedraw` re-renders the whole park page. With a map, the park page splits into a shell (rendered once per route, holding the map frame) and a dynamic part (counts, progress, list) that `parkRedraw` re-renders. The map is never rebuilt on a log change. `route()` calls `teardownParkMap()` next to `teardownGuide()`: `destroy()` clears the train timer, the ResizeObserver, listeners, and the tile cache. Trains also pause when the tab is hidden (`visibilitychange`) or the map is off screen (IntersectionObserver).
- **Logging from the map.** A tap selects a coaster and zooms to it, as in the spike. The app's plaque shows the name, ridden state, a **Ride page** link (`#/coaster/<id>`), and a **Log ride** or **Edit** button that calls the app's `quickLog` or `openLogModal`. The map never writes.
- **Accessibility.** The canvas stays `aria-hidden`. The park's coaster list is the accessible path to every ride. The spike's keyboard controls, the reduced-motion behavior (trains parked, zoom jumps), and the "My credits" coloring rule carry over.

**Performance budgets** (checked by `web_performance_engineer` on a mid-range Android phone, or Chrome with 4× CPU throttling and Fast 4G, at 390 px and at 1360 px):

| Measure | Budget |
| --- | --- |
| Pages without a published map | No change from today. Only `js/maps/index.js` (under 1 KB) is added. |
| Map payload per park | Data at most 64 KB gzipped (see above); renderer modules at most 80 KB uncompressed and 25 KB gzipped in total, cached after the first park |
| First map render | Within 2.0 s of navigation on a cold cache with Fast 4G, and 0.5 s warm. Decode and prepare at most 150 ms on the phone; first frame at most 100 ms. |
| Panning | At least 30 fps on the phone (at most 33 ms per frame) and 50 fps on desktop, at every zoom level |
| Zoom step | The new level appears within 150 ms. The step animation may scale the current frame (nearest neighbor) while new tiles render. |
| Trains | Overlay tick (10 a second) at most 4 ms. Paused when hidden or off screen; off under reduced motion. |
| Memory | At most 40 MB added at peak (Cedar Point, closest zoom): tile cache capped at 48 tiles |
| Logging from the park page | No slower than today |

**How the budgets are met:**

- **Precomputed data:** no OSM parsing, coaster assembly, or water flood fill in the browser.
- **Tiled base layer:** the base is drawn in 256 × 256 art-pixel tiles keyed by `(rotation, zoom, tx, ty)`. Each tile is rendered by the spike's renderer with the tile as its viewport, so tall objects that cross tile edges are drawn in every tile they touch. A tile keeps its pixels (a `<canvas>`), an id buffer (Uint16) for hit-testing, and a depth buffer (quantized to Uint16) so trains stay occluded. That is about 512 KB per tile, kept in a least-recently-used cache.
- **No rasterizing while dragging:** a drag only copies cached tiles to the visible canvas. Missing tiles show plain grass and are rendered within an 8 ms budget per frame, nearest first.
- **Redraw only on change:** base tiles change only with zoom, rotation, or a ridden-state change (only the affected tiles). Hover and selection draw on the overlay.
- **devicePixelRatio:** one art pixel is always a whole number of device pixels: `scale = max(1, round(2 × devicePixelRatio))` device pixels per art pixel. The canvas backing store is in art pixels, with CSS size `artWidth × scale / devicePixelRatio`, shown with `image-rendering: pixelated`. When `devicePixelRatio` changes (browser zoom, moving to another monitor), a `matchMedia('(resolution: …dppx)')` listener recomputes the scale and clears the tile cache.
- **Plain canvases** for tiles, not `ImageBitmap`, `OffscreenCanvas`, or workers, which keeps support for older iOS Safari. A worker renderer is a later option if phones miss the budget.

### Ride pages (C1a)

- **Route.** `route()` gains `page === 'coaster' && parts[1]` → `renderCoaster(parts[1])`, and the nav highlights **Coasters**. The page looks up `coasterById`. An unknown ID shows a friendly "Ride not found" state: if the part before `--` is a park ID, it links to that park, otherwise to `#/coasters`. A coaster ID is never rewritten or guessed.
- **Entry points:**
  - The coaster name in `coasterRow()` becomes a link to `#/coaster/<id>`. This covers park pages, the A–Z index and its search, and guide credit lists.
  - My Credits entries link their names.
  - The map plaque's **Ride page** link.
  - Guide ride blocks, plan steps, and ride-note headings link coaster names.
  - The ride page links back to its park.
- **Layout and reuse:**
  - A header with the name, the park (linked), and the state. Operating or retired status waits on Q-029; see open question T-4.
  - **Your ride:** `coasterRow(id)` plus `bindRows()`, so the toggle and the Log/Edit button are identical, followed by the full review (escaped) and the first-ride date and count. The log dialog is unchanged. `redrawCurrent()` gets a `coasterRedraw` that re-renders the "Your ride" block and recolors the vignette.
  - Then the vignette, stats (see the stats contract), and videos.
- **Vignette (decision 10).**
  - **Map vignette:** used when the coaster's park has a published map (or `?preview`) and the coaster has track in it. It is a `mountVignette` instance: non-interactive, framed on the coaster at a fixed close zoom, other coasters dimmed, trains running (parked under reduced motion), and the OSM credit under it. It reuses the park's cached map file and renderer if the rider came from the park page.
  - **Sprite vignette:** used otherwise. It is today's procedural sprite (`shapeOf(id)`), enlarged at a whole-number scale, with a stepped train animation (CSS `steps()` or a small timer driven by the sprite's existing profile keyframes). Colored when ridden, gray when not.
  - **In both:** the frame reserves its size from the first paint. A map vignette that fails to load falls back to the sprite. A caption marks the art as an illustration, and neither one implies the ride's real shape, height, or type.
- **Videos.** Up to three picks when they exist (Q-038). Recommended: a hand-edited `js/videos.js` keyed by coaster ID, lazy-loaded with the stats, reusing the guide's video card, YouTube ID validation, and tap-to-load `youtube-nocookie.com` embed rules. Nothing loads from a video site until the rider taps. Coasters without picks show no video box. The file format will be specified once Q-038 is answered.
- **Phone first:** at 390 px, "Your ride" sits near the top, stats are compact, and videos come last (spec C1a requirement 7).

### Ride stats file contract (v1)

Owned by `coaster_data_curator`, who produces the file. `engineering_manager` owns the contract. A copy for the curator is at `spikes/coaster-stats/CONTRACT.md` on branch `spike/coaster-stats`.

**Location and loading.** `js/stats.json`, generated by `scripts/stats/build.mjs` from cached raw responses (gitignored) plus the committed `sources/stats/links.json` (coaster ID → QID and Wikipedia title) and `sources/stats/overrides.json` (the curator's choices where sources disagree). The app fetches it once, on the first ride page, with the `loadGuide` retry pattern. The page renders without waiting for it and fills the stats panel when it arrives. Budget: at most 256 KB uncompressed and 64 KB gzipped (validator error), with a warning at 200 KB. If it outgrows the budget, shard by park (`js/stats/<park-id>.json`).

**Shape:**

```json
{
  "schema": 1,
  "license": "CC-BY-SA-4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "notice": "Loop Troupe ride stats, compiled from Wikipedia (© Wikipedia contributors, CC BY-SA 4.0) and Wikidata (CC0 1.0); values selected, unit-converted, and normalized by Loop Troupe. This file is available under CC BY-SA 4.0.",
  "generated": "2026-10-05",
  "coasters": {
    "cedar-point--millennium-force": {
      "refs": {
        "wd": { "qid": "Q1065056", "retrieved": "2026-10-02" },
        "wp": { "lang": "en", "title": "Millennium Force", "revid": 1234567890, "retrieved": "2026-10-03" }
      },
      "height":       { "v": 94.488, "pub": [310, "ft"], "src": "wp" },
      "length":       { "v": 2010.156, "pub": [6595, "ft"], "src": "wp" },
      "speed":        { "v": 149.668, "pub": [93, "mph"], "src": "wp" },
      "gforce":       { "v": 4.5, "src": "wp", "cite": "rcdb" },
      "manufacturer": { "v": "Intamin", "src": "wd" },
      "material":     { "v": "steel", "src": "wd" },
      "opened":       { "v": "2000-05-13", "src": "wd" }
    }
  }
}
```

(The `revid` and `retrieved` values above are illustrative.)

- **Keys** are coaster IDs that exist in `js/data.js`. A coaster with no data has no entry.
- **Provenance on every field.** Each field is `{ v, src, … }`. `src` names a key in that coaster's `refs`, and each ref holds the reference and the retrieval date. `wd` requires `qid` (`Q` plus digits) and `retrieved`. `wp` requires `lang` (`en`), `title`, `revid` (the revision the value was read from), and `retrieved`. Dates are `YYYY-MM-DD` and never in the future.
- **Fields (v1):** `height`, `drop`, `length` (m); `speed` (km/h); `duration` (s); `gforce` (g); `inversions` (an integer, with no `pub`); `manufacturer`, `designer`, `model` (strings); `material` (`steel`, `wood`, or `hybrid`); `type` (an array of strings); `opened` and `closed` (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, keeping the source's precision). New optional fields are additive and keep `schema: 1`.
- **Units: store metric, display imperial first.** `v` is metric, converted with exact factors (1 ft = 0.3048 m, 1 mph = 1.609344 km/h) and rounded to 3 decimals, so converting back reproduces the published figure. `pub` is `[number, unit]` exactly as the source states it (unit `m`, `ft`, `km/h`, `mph`, or `s`), and it is required whenever the source states a unit.
- **Display.** Imperial first (ft, mph), metric alongside. The unit the source published shows its `pub` number verbatim. The other unit is converted from `v` and rounded (ft, mph, and km/h to whole numbers; m to one decimal). This avoids the spike's X2 drift (175 ft shown as 174) wherever the source published imperial.
- **Missing fields are omitted.** No `null` and no empty strings. One value per field: where sources disagree, the curator decides against the primary source either cites (Q-036). An unresolved conflict is omitted, and the curator records it in `sources/stats/` (not shipped).
- **`cite`** (optional, `wp` values only): what Wikipedia cites for the value: `rcdb`, `park`, `manufacturer`, `news`, `other`, or `none`. It costs little now and lets the site hide RCDB-cited values if the owner chooses the stricter line in Q-040. RCDB is never contacted.
- **Never in this file:** OSM-derived values (decision 4), estimates, or values from any source other than Wikidata and Wikipedia.

**Ride page attribution:**

- **Each stat row names its source** in text ("Wikipedia" or "Wikidata"), not by color alone.
- **Credit line under the panel**, when any shown value came from Wikipedia: "Stats from the Wikipedia article [<title>](https://en.wikipedia.org/w/index.php?title=<title>&oldid=<revid>) by Wikipedia contributors, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Units converted by Loop Troupe." This covers title, author, source, license, and changes. When any shown value came from Wikidata, add "and [Wikidata](https://www.wikidata.org/wiki/<qid>) (CC0)". Include the retrieval date ("Checked 3 Oct 2026"). Final copy is `ux_content_designer`'s.
- **Missing values show as missing** (owner decision 3). The core rows (height, speed, length, inversions, G-force, manufacturer, opened, material) always appear, and a missing one reads as missing (for example "Not in open data"), never estimated. Open question T-5 covers coasters with no entry at all.
- **Escaping:** every string from the file is escaped. Links are built only from `qid` (`^Q\d+$`), `title` (URL-encoded), and `revid` (an integer).

### Deploy hygiene

Today the workflow publishes the whole tree, including `docs/`, `.claude/`, `.codex/`, `scripts/`, `AGENTS.md`, and `CLAUDE.md`, and it would publish `spikes/` and `sources/` once merged. **Change:** publish an allowlist, and run both validators first.

```yaml
      - uses: actions/checkout@v4
      - name: Validate guides
        run: node scripts/check-guides.mjs
      - name: Validate maps and stats
        run: node scripts/check-data.mjs
      - name: Publish site to gh-pages branch
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout --orphan gh-pages
          git rm -r -q --cached .
          touch .nojekyll
          git add -f index.html css js .nojekyll
          git commit -m "Deploy ${GITHUB_SHA}"
          git push -f origin gh-pages
```

- **Published:** `index.html`, `css/`, `js/` (including the map, stats, and license files), and `.nojekyll`.
- **Not published:** `docs/`, `spikes/`, `sources/`, `scripts/`, `.claude/`, `.codex/`, `.github/`, `AGENTS.md`, `CLAUDE.md`, and `README.md`. All of these stay readable in the public repository.
- **Orphan commit:** each deploy is a single commit, so `gh-pages` stops carrying `main`'s history.
- **Rollout:** ship this change on its own, before any map or stats file lands on `main`. `qa_engineer` then checks that the live site loads and that https://glockstock.github.io/LoopTroupe/docs/spec.md returns 404.
- **Rollback:** revert the workflow commit.
- **New top-level site folders** (for example `img/`) must be added to the allowlist on purpose. `codebase_curator` updates the deployment notes in `AGENTS.md` and `README.md`.

### Validation: `scripts/check-data.mjs` (specified; not yet implemented)

Node 18+, built-ins only (`vm`, `zlib`, `fs`). It loads `js/data.js` and `js/maps/index.js` in a `vm` sandbox, as `check-guides.mjs` does, reads the JSON files, and exits 1 on any error. Run it before committing changes to `js/maps/`, `js/stats.json`, or `js/data.js`. The deploy workflow runs it.

**Maps:**

- **Errors:**
  - A manifest key that is not a park ID; a missing or unparseable `src`; `schema !== 1`; `parkId` not equal to the manifest key.
  - `license`, `licenseUrl`, `attribution`, or `attributionUrl` missing or not the exact expected values.
  - A file over 200 KB, or over 64 KB gzipped.
  - Any `coasterId` that is not in `js/data.js`, belongs to another park, or appears twice on the map.
  - Any coaster of the park in `js/data.js` that is neither on the map nor in `absent`; an `absent` entry that is also on the map; an invalid `absent` reason.
  - Malformed geometry: odd-length or non-integer arrays, a ring under 3 points, a track under 2 points, decoded points outside `region`.
  - `peakFrom` not one of `team`, `osm`, `wikidata`, or `estimate`.
  - Any key named `user`, `uid`, `changeset`, `timestamp`, or `version` anywhere in the file (mapper privacy).
  - When `published: true`: any `inferred` link, or no `view`.
- **Warnings:** a file over 150 KB or 48 KB gzipped; `inferred` links on an unpublished map; unlinked coasters on the map; unknown fields; a map file not listed in the manifest.

**Stats:**

- **Errors:**
  - `schema !== 1`; `license` not `CC-BY-SA-4.0`; no `notice`.
  - A key not in `js/data.js`.
  - An unknown field; a field without `src`, or whose `src` has no complete ref (`wd`: `qid` and `retrieved`; `wp`: `lang`, `title`, integer `revid`, and `retrieved`).
  - A `null` or empty value.
  - A malformed or future date, or `closed` before `opened`.
  - `inversions` not a whole number; an invalid `material`.
  - A `pub` unit outside the allowed set, or `pub` disagreeing with `v` by more than 0.5% after conversion.
  - A value outside plausible ranges, which catches unit mix-ups: height and drop 1–200 m, length 20–3,000 m, speed 5–250 km/h, duration 10–600 s, G-force 0.5–6.5 g, inversions 0–14.
  - A file over 256 KB, or over 64 KB gzipped.
- **Warnings:** over 200 KB; `wp` values without `cite`.

**Coaster database and published tree:**

- **Warning:** any key in `js/data.js` other than the documented park and coaster fields. This keeps OSM- and Wikipedia-derived fields out of it.
- **Error:** any file under `js/` over 512 KB, which catches a raw extract committed by mistake.

**Summary:** per map, coasters on the map, absent by reason, and links by confidence; for stats, coverage per field and per source, and `cite` counts.

### Sequencing

1. **Deploy allowlist** (alone, with `qa_engineer`). Then add the `.gitignore` entries for `sources/*/raw/` and a `check-data.mjs` skeleton.
2. **Ride pages** (C1a) with the sprite vignette, no stats yet. Can ship as soon as it passes review.
3. **Stats file:** once the curator's file passes `check-data.mjs` and the 20-page spot check, wire up the stats panel and attribution.
4. **Map pipeline and Cedar Point map file:** port `fetch.mjs` and `model.mjs` to `scripts/maps/`, move the links and overrides to `sources/maps/`, and commit `js/maps/cedar-point.json` with `published: false`.
5. **Renderer port with tiles** behind `?preview`, then the art polish named in Q-037 (unridden contrast, phone panning, default view), performance, and reviews (`product_designer`, `motion_ux_engineer`, `web_performance_engineer`, `qa_engineer`, `product_experience_reviewer`). The team recognizes the layout; then flip `published: true`.
6. **Map vignette** on ride pages for coasters on a published map.
7. **The other four parks**, one at a time, each through steps 4–5 and the same bar.

**Do not merge the spike branches as they are.** Their raw extracts (6.6 MB of OSM data and 729 KB of Wikidata responses) would enter `main`'s history for good. Port the code and curated inputs instead, and keep the branches for reference.

**Rollback:** a map goes back to the diorama by setting `published: false`. Ride pages and stats only add routes and files, so reverting them leaves ride logs untouched.

### Open technical questions (to file in `docs/open_questions.md`)

- **T-1 (Q-034, bulk path):** Geofabrik extracts with a small Node PBF reader, or `osmium-tool` as a person-run tool? Needed before C1c, not for the pilot.
- **T-2:** Is Overpass reachable from a team member's machine? The spike environment blocked it. If not, the pilot falls back to the narrow main-API exception above.
- **T-3:** Can the site claim the 30 fps panning budget on a real mid-range phone? Verify with `web_performance_engineer` on the Cedar Point port before the art polish.
- **T-4 (Q-029):** May a ride page show "Closed <date>" from the stats file's `closed` field? Wikidata lags; for example, X2's 2026 closure is missing. Recommended: not until an operating or retired mechanism is settled.
- **T-5 (product):** Owner decision 3 says missing values "show as missing", but `docs/spec.md` C1a requirement 5 says "a missing value is left out". This plan shows the core rows with missing values marked. For coasters with no stats entry at all (more than half), show the full panel or a single line? `product_manager` and `product_designer` decide.
- **T-6:** Where do video picks live, and in what format? Waits on Q-038; the recommendation is above.

## Constraints

- Keep the no-build, no-framework, no-backend architecture unless the user approves a change.
- Any change to the storage schema or coaster IDs needs a versioned migration that preserves existing credits.
- No analytics or transmission of ride data without user approval.
