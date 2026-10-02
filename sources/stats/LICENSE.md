# Ride stats: licenses

**`js/stats.json` is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).** It is compiled from two sources:

- **Wikipedia**: figures and names read from English Wikipedia ride infoboxes, © Wikipedia contributors, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Wikidata**: figures, names, and dates from [Wikidata](https://www.wikidata.org), under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). There are no conditions, but we credit "Wikidata (CC0)" anyway.

Loop Troupe selected, unit-converted, and normalized the values. The license notice travels inside the file (`license`, `licenseUrl`, `notice`, `attribution`), and every coaster's `refs` names the Wikipedia article and the revision its values came from, or the Wikidata item.

**Using the values.** Wherever a Wikipedia value is shown:

- credit "Wikipedia contributors";
- link the article at the exact revision (`https://en.wikipedia.org/w/index.php?title=<title>&oldid=<revid>`);
- name CC BY-SA 4.0 with a link;
- say "Units converted by Loop Troupe".

Credit "Wikidata (CC0)" for Wikidata values. A copy or adaptation of the file must keep the notice and stay under CC BY-SA 4.0.

**What stays out.** No values from any other source go into the file: no RCDB (never contacted), no OpenStreetMap (ODbL cannot be combined with CC BY-SA), no park or manufacturer figures, and no estimates. Nothing from the file goes into `js/data.js` or the map files.

**This folder** (`sources/stats/`) holds the build's curated inputs and review notes. `links.json` and `overrides.json` are Loop Troupe's own curation. `review.json`, `coverage.md`, and `ambiguous.json` quote Wikipedia and Wikidata values for review, under the same licenses as above. `raw/` holds cached API responses and is never committed.
