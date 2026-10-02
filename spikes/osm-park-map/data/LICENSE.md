# Data license

The park files in this folder are derived from OpenStreetMap.

**Map data © OpenStreetMap contributors**, available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See https://www.openstreetmap.org/copyright.

- `<park>.json`: OpenStreetMap extracts (fetched via the OpenStreetMap API), converted
  to Overpass `out geom` form. ODbL.
- `<park>.links.json` and `<park>.overrides.json`: Loop Troupe's curated links from
  OpenStreetMap features to Loop Troupe coaster IDs, plus per-coaster rendering
  overrides. Because they extend the extracts, these files are offered under the
  ODbL as well.
- `synthetic-test-park.*`: invented test data, not from OpenStreetMap.

Images rendered from this data must credit "© OpenStreetMap contributors".
