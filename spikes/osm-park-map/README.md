# Spike: isometric park maps from OpenStreetMap

Status: **spike, not a feature.** Nothing here is linked from the site, and the site's files are unchanged. The renderer is built and tested against a **synthetic fixture** ("Test Park", fictional). No real park has been rendered yet because OpenStreetMap's Overpass API was unreachable from the build environment (see [Network status](#network-status)).

Question: can we generate Loop Troupe park maps in the site's pixel-isometric style semi-automatically, with small animations (a train on its circuit) and click-to-zoom on a ride? The approach here is **procedural from OpenStreetMap data**, where coaster track is mapped as ways tagged `roller_coaster=track`, rather than restyling map imagery with an image model.

## Run it

Serve the repository root with any static server, then open the spike page:

```sh
python3 -m http.server 8000
# http://localhost:8000/spikes/osm-park-map/
# http://localhost:8000/spikes/osm-park-map/?park=cedar-point   (after fetching)
```

| Command | What it does |
| --- | --- |
| `node spikes/osm-park-map/fetch.mjs --probe` | One tiny Overpass query: is the API reachable? |
| `node spikes/osm-park-map/fetch.mjs --print cedar-point` | Print the exact queries, no network |
| `node spikes/osm-park-map/fetch.mjs cedar-point` | Fetch one park into `data/cedar-point.json` |
| `node spikes/osm-park-map/fetch.mjs --all` | Fetch every park in `parks.json` (5 s apart) |
| `node spikes/osm-park-map/coverage.mjs --all` | Coverage report for every fetched park vs `js/data.js` |
| `node spikes/osm-park-map/coverage.mjs synthetic-test-park --db data/synthetic-test-park.db.json` | Exercise the matcher on the fixture |
| `node spikes/osm-park-map/make-synthetic.mjs` | Regenerate the synthetic fixture |

Behind an HTTPS proxy, Node's built-in `fetch` needs `NODE_USE_ENV_PROXY=1` (Node 22.21 or later), for example `NODE_USE_ENV_PROXY=1 node spikes/osm-park-map/fetch.mjs cedar-point`. The scripts use Node built-ins only and add no npm dependencies.

## Files

| File | Role |
| --- | --- |
| `index.html`, `map.css` | Standalone prototype page. Reuses `../../css/style.css` tokens and components read-only; reads `../../js/data.js` to link coasters to the site's database. |
| `page.mjs` | Page wiring: data picker, coaster key, status line, data notes. |
| `model.mjs` | Overpass JSON → park model in local meters: polygons, paths, coaster assembly, names, height profiles. Shared by the browser and Node. |
| `raster.mjs` | A tiny software rasterizer (scanline polygons, Bresenham lines, sprites) writing whole pixels into `ImageData`, plus an id buffer for hit-testing. |
| `map.mjs` | Isometric projection, scene composition, trains, highlight, zoom/pan/rotate, pointer and keyboard input. |
| `fetch.mjs` | Overpass fetcher → `data/<park-id>.json`. |
| `coverage.mjs` | Coverage report: Loop Troupe coasters vs OSM features vs track. |
| `parks.json` | Search hints for the five test parks (name pattern and an approximate point). |
| `make-synthetic.mjs` | Generator for the synthetic fixture. |
| `data/synthetic-test-park.json` | **Synthetic** fixture in Overpass `out geom` shape. Fictional park, negative ids, coordinates near 0°N 0°E. |
| `data/synthetic-test-park.db.json` | **Synthetic** coaster list for exercising `coverage.mjs`. |

## Pipeline

1. **Find the park.** Look up the `tourism=theme_park` outline by name near a known point.
2. **Fetch features** inside the outline's bounding box plus 120 m, with geometry clipped to that box.
3. **Model** (`model.mjs`): project to local meters (equirectangular around the park center, fine at park scale), assemble multipolygons, chain track ways into circuits, infer names, and lay a height profile on each circuit.
4. **Render** (`map.mjs`): 2:1 isometric, whole-pixel, drawn in our palette, shown at 2× with `image-rendering: pixelated`.

### Overpass queries (exact)

Step 1, for Cedar Point (`fetch.mjs --print cedar-point`):

```
[out:json][timeout:60];
nwr["tourism"="theme_park"]["name"~"^Cedar Point$",i](around:4000,41.4822,-82.6835);
out geom;
```

Step 2. `S,W,N,E` is the step-1 outline's bounds plus 120 m:

```
[out:json][timeout:180][maxsize:268435456][bbox:S,W,N,E];
(
  nwr["roller_coaster"];
  nwr["attraction"];
  way["highway"~"^(footway|path|pedestrian|steps|living_street|service|cycleway|track)$"];
  nwr["building"];
  nwr["natural"~"^(water|wood|scrub|beach|sand|tree_row)$"];
  nwr["water"];
  node["natural"="tree"];
  nwr["landuse"~"^(forest|grass|meadow|village_green|recreation_ground|flowerbed|basin|reservoir)$"];
  nwr["leisure"~"^(garden|park|swimming_pool|water_park)$"];
  nwr["amenity"="parking"];
  way["railway"~"^(rail|narrow_gauge|miniature|monorail|light_rail)$"];
);
out geom(S,W,N,E);
```

`out geom(bbox)` clips geometry so a huge lake or forest relation touching the park (Lake Erie, for example) does not dump its whole outline. Clipped coordinates can arrive as gaps; the model splits ways at gaps and skips rings that cannot close, with a warning. This clipping behavior is untested against the live server.

### Data shape

`data/<park-id>.json` is Overpass's own JSON (`version`, `generator`, `osm3s`, `elements[]`). With `out geom`, ways carry `nodes[]`, `geometry[{lat,lon}]`, `bounds` and `tags`; relations carry `members[{type,ref,role,geometry}]`. `fetch.mjs` adds a `loopTroupe` block: park id, matched outline element, bbox, fetch time, endpoint, both queries, and the attribution string. The fixture has the same shape, with `loopTroupe.synthetic: true`.

### Coasters: assembly and names

- Track ways sharing a node (or, as a fallback, identical coordinates) form one component. Spurs such as transfer and storage tracks are pruned; the remaining loop is walked, taking the straightest branch at junctions. If nothing loops, the track is treated as open (shuttle or launch) and the longest path is used.
- Name, first match wins: the track way's `name`; a named `attraction=roller_coaster` area containing at least half of the track; a named `attraction=roller_coaster` point within 75 m; otherwise "Unnamed coaster n". Components with the same name are grouped, so dueling or racing coasters stay one coaster.
- A named `attraction=roller_coaster` with no track is kept and drawn as a signpost, so coverage gaps stay visible.
- Station: the nearest `roller_coaster=station` within 40 m of the track, otherwise the start of the way.
- Wooden: `material=wood`, `roller_coaster:material=wood`, or `roller_coaster:type` containing "wood". Wooden tracks get lattice bents instead of cream steel columns.

### Height heuristic (and its limits)

OSM maps track in plan view only. There is no vertical geometry.

- **Peak:** a `height` (or `roller_coaster:height`) tag on the track or its attraction, parsed for m, ft or `'`. Otherwise **estimated** as `0.055 × √(track length × footprint diagonal)`, clamped to 6–60 m. Open tracks use `0.2 × length`. As sanity checks against approximate public figures (not data): Blue Streak (~780 m long, ~330 m across) estimates 28 m against a real ~24 m; Magnum XL-200 hits the 60 m cap against ~62 m; Millennium Force also caps at 60 against ~94 m.
- **Profile** along the circuit from the station, in the order of the OSM nodes: flat station, then a chain lift to the peak (about 1.8 × peak in length), a cosine first drop, hills tapering from ~72% to ~30% of the drop, and a brake run back into the station. Open tracks get a launch profile: flat launch, one top hat, run-out.
- **Limits:** direction of travel is a coin flip (OSM way direction is arbitrary). There are no loops, inversions or helices. Mice, spinners and terrain coasters get the wrong shape. Terrain is flat, so hillside parks (Dollywood, Magic Mountain) will be wrong. Indoor coasters are drawn outdoors. **The profile is decorative and must never be presented as ride data**; ride stats are a product non-goal.
- **Fix-ups:** an optional `data/<park-id>.overrides.json` keyed by coaster name takes `{ "reverse": true, "height": 94, "stationAt": 0.3, "wooden": true }`. Curated overrides are the realistic route to good-looking real parks.

## Rendering rules (from docs/design_guide.md)

- 2:1 projection exactly as in `js/app.js`: a sub-unit moves 2 px across and 1 px down. A sub-unit is M meters, where M is the zoom step (16 m down to 0.5 m). Vertices snap to the sub-unit lattice, so edges stair-step cleanly. The canvas is drawn at native resolution by our own rasterizer (no canvas anti-aliasing) and displayed at an integer 2× with `pixelated` scaling.
- Palette: the site's grass checker, dirt slab with a green lip, sand footpaths (the diorama path colors), water with shimmer pixels, cream walls with lit and shaded faces, muted roofs so coasters own the color. Coaster tracks use `TRACK_COLORS`. Linked parks use the coaster's index in `js/data.js`, so a coaster has the same color as on the rest of the site. Station roofs match the track color.
- The ground is a slab shaped like the real park outline. Flat features are clipped to it.
- Painter's algorithm by iso depth (u + v) for buildings, track segments, supports, trees and sprites.
- Level of detail: tiny trees and no guests at overview; full trees (the site's sprites), windows, lift chains, guests and thicker rails when zoomed in.
- Trains: cream cars stepping 10 times a second. They are slow on the lift and fast where the drop is deep (√(2gΔh)), and dwell in the station. With `prefers-reduced-motion: reduce` there is no animation: trains are parked in stations and zoom jumps instead of stepping.
- Interaction: hover (mouse) or tap shows a wood plaque with the name and outlines the coaster. Click or tap zooms to it in five stepped frames. Drag pans, the wheel or two-finger pinch steps the zoom, and Rotate turns the view 90°. Keyboard: the map takes focus (arrows, + and −, 0, R, Esc), and the coaster key below the map is the accessible and phone-friendly way to reach every ride.
- Attribution "Map data © OpenStreetMap contributors" sits on the map for real data. The synthetic fixture is labeled in the window title, a yellow banner, a ribbon on the map itself, and the data notes.

Render time in Chromium on the build machine: 5–12 ms per frame for the fixture at 1360 px. With buildings, trees and paths multiplied ×10 it was also about 12 ms. A large real park has more geometry than that, so it needs measuring.

## Network status

During this spike the environment's proxy refused `overpass-api.de` and `api.openstreetmap.org`. Later in the session `overpass-api.de` was let through the proxy but reset the connection mid-request (`ECONNRESET`). `api.openstreetmap.org` and the `overpass.kumi.systems` mirror began answering. We did not use either:

- The brief made Phase B conditional on `overpass-api.de`.
- The OSM editing API's usage policy is for editing, not bulk reads.

So no real park has been fetched. Retry with `fetch.mjs --probe`. A mirror can be used with `--endpoint URL` if the owner approves it.

## Licensing notes (flag for product_manager and engineering_manager; not decided here)

Not legal advice. OSM data is © OpenStreetMap contributors under the **Open Database License (ODbL 1.0)**.

- **Attribution is required** wherever the maps are shown publicly. A visible "© OpenStreetMap contributors" credit linking to https://www.openstreetmap.org/copyright must sit on or next to the map.
- **Produced Work vs database.** A rendered map image is a "Produced Work" and may be published under terms we choose, with attribution. But if the work is made from a **Derivative Database** (OSM data we have modified, merged or extended), ODbL §4.6 requires us to offer that derivative database, or a way to recreate it, under the ODbL.
- **Our static site would ship the data itself.** Serving `data/<park>.json` (or a simplified park JSON) to browsers is public distribution of a database derived from OSM. That file would have to be under the ODbL, carry attribution, and be available to anyone who receives it.
- **Keep it out of `js/data.js`.** Merging OSM-derived fields (geometry, OSM ids, heights) into `js/data.js` risks making the combined database share-alike. Keeping a separate, clearly licensed map-data file that only links by coaster id is the safer pattern; see OSMF's community guidelines on Produced Works, Collective Databases and Horizontal Layers. Curated overrides layered onto OSM geometry would likely be part of the derivative database.
- **Fetch at build time, never from riders' browsers.** The public Overpass instance has a fair-use policy (roughly 10,000 queries and 1 GB a day). Runtime calls would also send rider IPs to a third party, which conflicts with Loop Troupe's privacy stance (AGENTS.md).
- The Isometric NYC approach relied on Google Maps imagery. Restyling third-party imagery raises separate terms-of-service problems this spike avoids.

## What ship quality would take

1. Real data: fetch the five test parks, read `coverage.mjs`, and render Cedar Point. Expect tagging variance (outlines as relations, split or unnamed tracks, missing stations).
2. A curated OSM-to-coaster-id link table and per-coaster overrides (direction, station, peak), owned by the data curator. Do not rely on runtime name matching.
3. Build-time generation into a small, simplified, ODbL-licensed park-map file per park, after the licensing decision.
4. Surroundings: parking and water outside the outline (Cedar Point sits on a peninsula), a better background than sky.
5. Art: per-type silhouettes (loops and inversions where tagged), better station and queue art, occlusion-aware trains, persistent labels at close zoom, and an overview that stays legible on phones.
6. Reviews: product_designer (flows, accessibility), motion_ux_engineer (train and zoom stepping), web_performance_engineer (large parks, low-end phones).
