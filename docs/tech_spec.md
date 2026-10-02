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
| `js/guides/` | Park guide manifest (`index.js`) and one content file per guide. Not yet loaded by the app; see "Park guides". |
| `scripts/check-guides.mjs` | Node validator for guide content (`node scripts/check-guides.mjs`). |

### Routing

Hash routes: `#/` (home), `#/parks?state=XX`, `#/park/<park-id>`, `#/coasters`, `#/credits`. Unknown routes render home. Planned: `#/guide/<park-id>[/<section-id>]` (see "Park guides").

### Coaster database

`COASTER_DB.parks[]`: `{ id, name, city, state, defunct?, coasters: [{ id, name }] }`. Park IDs are slugs; coaster IDs are `<park-id>--<coaster-slug>`. **IDs are a durable contract.** Ride logs are keyed by coaster ID, so an ID must never change or be reused. The September 2024 source scrape and the one-off build script are not in the repository; future edits are made directly in `js/data.js`.

### Ride-log storage

`localStorage['coaster-credits.v1']` = `{ version: 1, rides: { [coasterId]: { date: 'YYYY-MM-DD', rating: 0-5, review: string, count: int >= 1, loggedAt: epoch ms } } }`. A rating of 0 means unrated. Backups export the same `rides` object as JSON; import merges entries whose coaster IDs exist and skips unknown ones. Read failures fall back to an empty log.

### Rendering

Views render HTML strings into `#view`; all user-entered text passes through `esc()`. Isometric park scenes are generated SVG: a 2:1 isometric grass diamond with `<use>` references to shared pixel sprites, colored per coaster when ridden.

### Deployment

`.github/workflows/deploy.yml` runs on every push to `main`, force-pushing the tree (plus `.nojekyll`) to `gh-pages`, which GitHub Pages serves. Pushing to `main` is a production release.

## Park guides (approved plan; content contract in place, UI not yet implemented)

**Approved by the owner on 2026-10-02:** the first park guide is Cedar Point, built as a mobile web guide inside this static site. Guide content lives in the public repository for now ("I don't care that the GH is public for now"). No paywall, checkout, accounts, or analytics yet. The no-build, no-framework, no-backend architecture stays. `docs/proposals/accounts-and-payments.md` remains a proposal for later. Product requirements: `docs/guides/cedar-point-brief.md`.

**State today:** the content contract exists and validates: `js/guides/index.js` (manifest), `js/guides/cedar-point.js` (placeholder skeleton), and `scripts/check-guides.mjs`. `index.html` and `js/app.js` do not load or render guides yet.

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

Planned next: run this command as a step in `.github/workflows/deploy.yml` before publishing, so a broken guide cannot ship.

### Content in a public repository

Accepted by the owner for now. Anything committed stays in public git history even if guide content later moves behind a paywall, so a future paid edition should be treated as new writing rather than relying on removing the free version (see Q-020). `verifiedBy` names are public too; use the credit the team agrees to (Q-028).

## Constraints

- Keep the no-build, no-framework, no-backend architecture unless the user approves a change.
- Any change to the storage schema or coaster IDs needs a versioned migration that preserves existing credits.
- No analytics or transmission of ride data without user approval.
