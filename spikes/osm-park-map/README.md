# Spike: isometric park maps from OpenStreetMap

Status: **spike, not a feature.** Nothing here is linked from the site, and the site's files are unchanged.

Five real parks were fetched from the main OpenStreetMap API, one request each:

- Cedar Point
- Kings Island
- Dollywood
- Six Flags Magic Mountain
- Knoebels

The renderer was first built against a **synthetic fixture** ("Test Park", fictional), which is still in place as a regression case.

Question: can we generate Loop Troupe park maps in the site's pixel-isometric style semi-automatically, with small animations (a train on its circuit) and click-to-zoom on a ride? The approach is **procedural from OpenStreetMap data**, where coaster track is mapped as ways tagged `roller_coaster=track`. We do not restyle map imagery with an image model.

## Run it

Serve the repository root with any static server, then open the spike page:

```sh
python3 -m http.server 8000
# http://localhost:8000/spikes/osm-park-map/                     synthetic fixture
# http://localhost:8000/spikes/osm-park-map/?park=cedar-point    real data
```

| Command | What it does |
| --- | --- |
| `node spikes/osm-park-map/fetch.mjs --source osm-api cedar-point` | Main OSM API: **one** `/map.json` request for the park's `bbox` in `parks.json`, converted to Overpass `out geom` shape |
| `node spikes/osm-park-map/fetch.mjs --probe` | One tiny Overpass query: is Overpass reachable? |
| `node spikes/osm-park-map/fetch.mjs --print cedar-point` | Print the exact Overpass queries, no network |
| `node spikes/osm-park-map/fetch.mjs cedar-point` | Fetch one park through Overpass |
| `node spikes/osm-park-map/coverage.mjs --all` | Coverage report for every fetched park vs `js/data.js` (uses the links files) |
| `node spikes/osm-park-map/coverage.mjs <park> --draft-links` | Write `data/<park>.links.json.draft` for the curator to review |
| `node spikes/osm-park-map/make-synthetic.mjs` | Regenerate the synthetic fixture |

Behind an HTTPS proxy, Node's built-in `fetch` needs `NODE_USE_ENV_PROXY=1` (Node 22.21 or later). The scripts use Node built-ins only and add no npm dependencies.

## Files

| File | Role |
| --- | --- |
| `index.html`, `map.css` | Standalone prototype page. Reuses `../../css/style.css` read-only, and reads `../../js/data.js` to link coasters to the site's database. |
| `page.mjs` | Page wiring: data picker, ride-log colors, coaster key, status line, data notes. Reads `localStorage['coaster-credits.v1']` **read-only**. |
| `model.mjs` | OSM JSON → park model in local meters. It builds the drawn region, polygons, roads and paths, open water from partial shorelines, coaster assembly (direction from `oneway`), names, curator links, and height profiles. Shared by the browser and Node. |
| `raster.mjs` | A tiny software rasterizer: scanline polygons, Bresenham lines and sprites in whole pixels, with an id buffer for hit-testing and a depth buffer for occlusion. |
| `map.mjs` | Isometric projection, scene composition, trains, highlight, numbered overview pins, zoom/pan/rotate, pointer and keyboard input. |
| `fetch.mjs` | Fetcher for Overpass and the main OSM API (`--source osm-api`) → `data/<park-id>.json`. |
| `coverage.mjs` | Coverage report and link drafting. |
| `parks.json` | The five test parks: name pattern, search point, fetch bbox, and the `js/data.js` park id. |
| `data/<park>.json` | Fetched OSM data (© OpenStreetMap contributors, ODbL). |
| `data/<park>.links.json` | **Curated** OSM coaster → Loop Troupe coaster id table (see below). |
| `data/cedar-point.overrides.json` | **Curated** per-coaster render fixes: peak heights, launch profile, wooden structure. |
| `make-synthetic.mjs`, `data/synthetic-test-park*.json` | The **synthetic** fixture, its fake coaster list and overrides. Fictional park, negative ids, coordinates near 0°N 0°E. |

## Getting the data

### Main OSM API (what was used)

- One GET to `https://api.openstreetmap.org/api/0.6/map.json?bbox=W,S,E,N` per park.
- A tight bbox from `parks.json`: 0.00014–0.00042 square degrees against the 0.25 limit.
- Raw node counts: 4,724 (Knoebels) to 41,887 (Cedar Point), against the 50,000 limit.
- Requests sent with a project User-Agent and 6 s apart.
- The script stops on 429 or 509, never retries in a loop, and never runs at page runtime.

The response is converted to the Overpass `out geom` shape the renderer already reads:

- Way geometry is resolved from the response's nodes.
- Multipolygon members carry their way geometry. Members outside the bbox are absent.
- Only the tags the Overpass query would select are kept.
- **Editing metadata (user names, uids, changesets, timestamps) is dropped.**

A `loopTroupe` block records the source, the bbox, the outline bbox with a 120 m buffer, the fetch time, raw counts and notes. The bbox is "refined" by recording the outline's own bounds and flagging when the outline touches the edge of the fetch. No second request is made. Kings Island and Knoebels touch the edge, but their outlines overrun into parking and campground only; all track lies inside the box.

### Overpass (built, still unreachable here)

The Overpass path makes two requests: one to find the outline by name near a point, and one for everything in its bbox plus 120 m, with geometry clipped to that box. Both queries are printed by `fetch.mjs --print <park>`. The selection is identical to the OSM API filter in `fetch.mjs` (`wanted()`).

## Model

- **Region:** the outline's bounds plus 220 m of surroundings, clipped to the fetched bbox. Roads, parking, hotels, beaches and trees outside the park are drawn on muted grass. The park sits on bright checkered grass behind a fence line.
- **Open water:** Lake Erie and similar lakes arrive as partial `natural=water` relations whose rings cannot close inside the box. Their shoreline ways are rasterized onto a 4 m grid and the rest is flood-filled into faces. A face that touches a shoreline and holds almost no land evidence (park outline, buildings, roads, parking) is water. Cells the shoreline crosses are resolved per point by which side of the nearest segment they fall on. Known risk: a featureless island would read as water.
- **Coasters:** track ways sharing nodes form components. Spurs are pruned and the loop is walked.
  - Direction of travel comes from `oneway` tags, weighted by length, when present (16 of 19 Cedar Point coasters). Otherwise it is a guess.
  - Short unnamed open pieces, and open pieces of a coaster that also has a full circuit, are drawn flat as spur or storage track.
  - Names come from the track way, a containing `attraction=roller_coaster` area, or a named feature within 75 m.
- **Curator links** (`data/<park>.links.json`): each entry matches an OSM coaster by name, by any track way id, or by its feature.
  - It sets a Loop Troupe `coasterId`, a `match` type (exact, fuzzy, manual, inferred, none) and a `confidence`, plus a note and a check date.
  - Entries sharing an id merge. Kings Island's Racer is mapped as two tracks; Twisted Colossus is a named stub plus an unnamed circuit.
  - `notCoaster: true` drops mis-tagged features: flume channels at Knoebels, White Water Canyon at Kings Island, and Pipe Scream at Cedar Point (a thrill ride per the guide).
  - Fuzzy name matching is only a drafting aid. It proposed "Son of Beast" for The Beast and "Colossus" for Twisted Colossus until exact matches were given priority.
- **Heights:**
  - The peak comes from, in order: a curated override, an OSM `height` tag (only Maverick and two SFMM coasters have one), or an estimate of `0.055 × √(length × footprint)`, clamped to 6–60 m.
  - A generic profile runs from the station: lift, cosine drop, tapering hills, brake run. `profile: "launch"` gives a flat launch, a near-vertical top hat and a run-out.
  - The profile is **decorative** and must never be presented as ride data.
  - Limits: no inversions or helices, flat terrain (wrong for Dollywood), and indoor coasters drawn outdoors.

## Rendering rules (from docs/design_guide.md)

- **Projection:** 2:1 exactly as in `js/app.js`. A sub-unit moves 2 px across and 1 px down and equals M meters (32 m down to 0.5 m). Vertices snap to the lattice. The canvas is drawn at native resolution by our own rasterizer and shown at an integer 2× with `pixelated`.
- **Occlusion:** a per-pixel depth buffer. In this projection, u + v of the surface under a pixel is exactly its distance toward the viewer. Roofs take it from screen row plus roof height, walls interpolate along the wall, and track interpolates along each segment. Trains are drawn on an overlay but depth-tested against the base, so buildings, station roofs and nearer track hide them.
- **Credits:** Loop Troupe's convention applies.
  - A coaster takes its site color (its index in its `js/data.js` park) once it is in the rider's log, and is a gray ghost with gray supports and no train until then.
  - "My credits" can be turned off to show all colors. It defaults to on when the rider has logged anything at this park.
  - The hover/tap plaque reads "Steel Vengeance · ridden". The status line adds the first logged date and ride count. The rider's review text is never shown.
- **Level of detail:**
  - At overview (M of 8 or more): numbered pins in each coaster's color, matching the key list, at each coaster's peak, with simple collision nudging. No trains, no attraction sprites, and footpaths as 1 px lines.
  - At middle zooms (M of 4–5.5): a small gate sprite, small trees, no carousel or stall.
  - Close up: full tree sprites, windows, lift chains, guests and 3 px rails.
- **Default view:** frames the coasters, not the outline (outlines often include lots and campgrounds), on whichever of the four rotations shows them largest. Rotate turns the view 90°. A straight launch coaster (Top Thrill 2) can line up with the view axis; rotate to see its top hat side-on.
- **Motion:** trains step 10 times a second. Zoom steps through 5 frames. `prefers-reduced-motion` parks trains and jumps the zoom.
- **Attribution:** "Map data © OpenStreetMap contributors" is linked in a strip directly under the map, at every width.

Render time in Chromium on the build machine, Cedar Point at 1360 px: about 30–90 ms per frame depending on zoom (4,800 elements, 712 buildings, about 1,000 paths and trees). That is fine for stepped zoom; drag-panning runs at about 12–25 fps.

## Coverage (OSM data fetched 2026-10-02)

Loop Troupe's lists include retired coasters, so "missing" mixes gaps in OSM with rides that no longer exist.

| Park | In `js/data.js` | Named `attraction=roller_coaster` | `roller_coaster=track` ways → coasters | Linked to Loop Troupe |
| --- | --- | --- | --- | --- |
| Cedar Point | 23 | 19 | 185 → 18 (after dropping Pipe Scream) | 18; all 18 on the guide's 2026 operating list |
| Kings Island | 20 | 3 | 110 → 18 | 14 (Flight of Fear inferred) |
| Dollywood | 11 | 5 | 44 → 10 | 8 |
| Six Flags Magic Mountain | 25 | 17 | 90 → 14 (+2 trackless) | 16 (Twisted Colossus partly inferred) |
| Knoebels | 8 | 5 | 42 → 5 (after dropping 2 flume channels) | 5 |

Run `node spikes/osm-park-map/coverage.mjs --all` for per-coaster tables.

## Licensing and usage (flag for product_manager and engineering_manager; not decided here)

Not legal advice. OSM data is © OpenStreetMap contributors under the **Open Database License (ODbL 1.0)**.

- **Attribution** is required wherever maps are shown publicly: "© OpenStreetMap contributors" linking to https://www.openstreetmap.org/copyright, on or next to the map.
- **Rendered images** are Produced Works and can be published under terms we choose, with attribution. If they are made from a **Derivative Database** (OSM data we modified, merged or extended), ODbL §4.6 requires offering that database, or a way to recreate it, under the ODbL.
- **This branch commits the data.** `data/<park>.json` (about 6.7 MB) are OSM extracts. The link and override files layer curated data onto them and are likely part of a derivative database. `.github/workflows/deploy.yml` publishes the whole repository, so **merging this branch to `main` would publicly distribute these files**. They would need to be ODbL-licensed and attributed, or excluded from the deploy.
- **Keep OSM-derived fields out of `js/data.js`.** Merging geometry, OSM ids or heights into it risks pulling the coaster database under share-alike. A separate map-data file linked by coaster id is the safer pattern; see OSMF's community guidelines on Produced Works, Collective Databases and Horizontal Layers.
- **The OSM editing API** (`api.openstreetmap.org`) is primarily for editing. Its usage policy tolerates light read use but not bulk or production data consumption. Five identified, spaced requests for a spike are within that spirit; a production pipeline should use Overpass, planet or regional extracts (for example Geofabrik), and never call OSM from riders' browsers. The same goes for Overpass's fair-use limits, and for privacy: no rider IPs should go to third parties.
- **Mapper privacy:** user names and uids were stripped from the saved files.
- **Imagery:** the Isometric NYC approach relied on Google Maps imagery. Restyling third-party imagery raises separate terms-of-service problems this spike avoids.

## What ship quality would take

1. A licensing decision, then build-time generation of a small, simplified, ODbL-licensed park-map file per park, kept out of `js/data.js`.
2. Curator work per park: confirm inferred links, fix OSM upstream (unnamed tracks, "Lighting Rod", flume channels tagged as track), add overrides (heights, launch profiles, wooden structures) with sources.
3. Art:
   - per-type silhouettes (inversions, helices, top hats where tagged);
   - station and queue art;
   - stronger ghost readability at overview;
   - terrain for hillside parks;
   - labels at close zoom;
   - a hand-tuned default view per park.
4. Performance: precompute ground layers per zoom level, or cache tiles, to make drag-panning smooth on phones.
5. Reviews: product_designer (flows, accessibility of the pins and key), motion_ux_engineer (train and zoom stepping), web_performance_engineer (large parks, low-end phones), qa_engineer (ride-log reading).
