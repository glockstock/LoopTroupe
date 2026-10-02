# Ride stats: notes on the contract

From `coaster_data_curator`, 2026-10-02, for `engineering_manager` to fold into `docs/tech_spec.md` ("Ride stats file contract (v1)"). This file records where `js/stats.json`, as built by `scripts/stats/build.mjs`, differs from or adds to the contract. Nothing here changes coaster IDs, `js/data.js`, or the ride log.

## 1. Approved deviation: `refDefaults` (size)

With full refs on every coaster, the file was 277 KB, over the 256 KB budget. The coordinator approved hoisting the values that are the same for every coaster, and the file is now 250.8 KB (256,845 bytes; 36.3 KB gzipped).

- A new top-level `refDefaults` holds the shared ref fields: `{ "wd": { "retrieved": "YYYY-MM-DD" }, "wp": { "lang": "en", "retrieved": "YYYY-MM-DD" } }`.
- Per coaster, `refs.wd` is `{ qid }` and `refs.wp` is `{ title, revid }`. A ref may still set its own `lang` or `retrieved`; that value wins.
- **Effective ref = `{ ...refDefaults[src], ...refs[src] }`.** Every rule about refs (required keys, date format, never in the future) applies to the effective ref. `scripts/check-stats.mjs` checks it that way.
- A top-level `format` string states the deviation inside the file, since JSON has no comments.

**Ride page change:** merge `refDefaults` before reading `lang` or `retrieved` (for the "Checked <date>" credit line). `title`, `revid`, and `qid` are where they were.

## 2. Other additions (additive; `schema` stays 1)

- **`attribution`** (top level): the credit to show (Wikipedia contributors, the article at `revid`, CC BY-SA 4.0, "Units converted by Loop Troupe"; "Wikidata (CC0)"). The license notice and this text travel inside the file.
- **`generated`** is the latest retrieval date of the raw data, not the build day. That makes `build.mjs --offline` byte-identical on any day. Dates "never in the future" are checked against that same retrieval date in the build, and against today in the validator.

## 3. Duration `pub`

`pub` is "the figure exactly as the source states it", and the allowed units have no minutes. So a duration has `pub: [n, "s"]` only when the source states seconds ("45 seconds", or a Wikidata value in seconds). An infobox's "2:30" gives `v: 150` with no `pub`. Height, drop, length, and speed always have `pub`.

**Ride page change:** format duration from `v` (seconds) when there is no `pub`, for example as "2:30".

## 4. `cite`

- `cite` is set only where the infobox value carries its own inline `<ref>`: `park`, `manufacturer`, `news`, `rcdb`, or `other`.
- With no inline reference, `cite` is **omitted, never `none`**, because the article body may still cite the figure. "Unknown" is the honest reading.
- Most Wikipedia values therefore have no `cite`. The validator's "wp values without cite" warning is printed once, as a count.

## 5. Curated inputs and review notes in `sources/stats/`

| File | Committed | What |
| --- | --- | --- |
| `links.json` | yes | Coaster ID → `wd` (QID) and `wp` (article title), plus `wpBox` (which infobox, when an article has several), `wpTrack` (one track of a dual-track infobox), `earlierRide` (credits the article also covers, whose figures are never used), evidence, and `manual` (kept as written on relink). The build uses only these links and never matches by name at build time. `build.mjs --relink` proposes them again from the raw data. |
| `overrides.json` | yes | `rules` (one source's stated value for a list of coasters, with a reason) and `choices` (one source for one coaster and field, with the primary source as `basis`). |
| `review.json` | yes | Conflicts withheld, conflicts resolved, values left out with their raw text, link problems, and parsed infobox fields outside the contract (max vertical angle, status). |
| `coverage.md` | yes | Generated coverage report. |
| `ambiguous.json` | yes | Matches the build would not make on its own, for a person to decide. |
| `LICENSE.md` | yes | Licenses for the file and the folder. |
| `raw/` | no (gitignored as `sources/*/raw/`) | Cached Wikidata and Wikipedia responses (infobox wikitext only, not whole articles). |

## 6. Curation rules applied

- **Material, RMC I-Box conversions = `hybrid`.** Rule `rmc-ibox-conversion-hybrid` in `overrides.json`. Rocky Mountain Construction I-Box retracks of an existing wooden coaster keep the wooden structure, and enthusiasts call them hybrids. Wikipedia's infobox allows only Steel or Wood, so the value comes from Wikidata, which states "hybrid roller coaster". Where no source states hybrid (Twisted Cyclone, Storm Chaser), the material is withheld rather than shipped as steel. Topper Track rides built new as wooden coasters (Outlaw Run, Goliath at Six Flags Great America) stay `wood`. Older steel-track coasters on wooden structures (Arrow's Gemini, Cedar Creek Mine Ride) are not covered by the rule and ship Wikipedia's `steel`. Lightning Rod (wood vs steel), Tremors, Magic Flyer, and Seabreeze's Bobsleds remain withheld conflicts.
- **Conflicts** are withheld unless a rule or a choice with a primary source settles them. One choice so far: Full Throttle's height comes from Wikidata (49 m), because the park's own page gives 160 ft.
- **Dual-track coasters** (`Infobox dual roller coaster`, for example Gemini): shared fields as usual. A per-track figure is used when both tracks state it and agree, or for one track when `js/data.js` lists the tracks as separate credits.
- **Rides that replaced another credit** (Top Thrill 2 / Top Thrill Dragster and 8 others): the infobox's figures go only to the ride it is named for, and any value footnoted or qualified as the earlier ride's is dropped.

## 7. Validation

`scripts/check-stats.mjs` is standalone, not part of `scripts/check-data.mjs`, which the map work owns on another branch. It covers every stats check in "Validation" (errors and warnings), reads refs through `refDefaults`, and prints coverage per field and source plus `cite` counts. The deploy workflow runs it after the guide check. Fold it into `check-data.mjs` later, or keep both.

## 8. Size headroom

The file is 250.8 KB raw and 36.3 KB gzipped, against budgets of 256 KB and 64 KB. That is over the 200 KB warning line, with about 5 KB of raw headroom. Each new coaster with full stats adds about 0.5 KB. When it grows past the budget, the next step is the contract's own: shard by park (`js/stats/<park-id>.json`). Raising the raw budget instead is also reasonable, since the file is served gzipped and stays far under 64 KB.
