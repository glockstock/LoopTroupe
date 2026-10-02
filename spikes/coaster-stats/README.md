# Spike: coaster stats from Wikidata and Wikipedia

Question: how much ride-stat data ("speed, G force, etc") can Loop Troupe get from open sources for the coasters in `js/data.js`, keyed by our coaster IDs?

Short answer: with Wikipedia's ride infoboxes added to Wikidata, about 38% of our 1,036 coasters now have height, speed, and length (35% have all three), up from about 4% with Wikidata alone. Inversions cover 34%, ride duration 31%, and G-force 12% (125 coasters, all from Wikipedia). Manufacturer covers 45% and opening date 41%. 503 coasters (49%) have at least one value. See `coverage.md` for the numbers.

This is a spike. Nothing here is loaded by the app. The output follows the shape in `CONTRACT.md` (ride stats file contract v1), but it still lives here: porting the two scripts into `scripts/stats/build.mjs` and writing `js/stats.json` on `main` is a separate step.

## License and attribution

The owner's decision (2026-10-02): stats come from Wikidata and from English Wikipedia ride infoboxes, ride pages credit Wikipedia, and the stats file is offered under CC BY-SA.

- **Wikipedia values are CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/), © Wikipedia contributors. Infobox figures are facts, but we treat Wikipedia's selection of them as licensed content and meet both conditions:
  - **Attribution.** Wherever a value is shown, credit Wikipedia and its contributors, link the article at the exact revision the value came from (`https://en.wikipedia.org/w/index.php?oldid=<revid>`; `refs.wp` has the title and `revid`), name the license with a link, and say that we changed it ("Units converted by Loop Troupe"). Example: *Stats: [Millennium Force](https://en.wikipedia.org/w/index.php?oldid=…), Wikipedia contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Units converted by Loop Troupe.*
  - **Share-alike.** The stats file, and anything derived from it, is offered under CC BY-SA 4.0. It must not be mixed with data under an incompatible license (for example OpenStreetMap's ODbL), and nothing from it goes into `js/data.js`.
- **Wikidata values are CC0 1.0.** No conditions, but credit "Wikidata (CC0)" next to them anyway, as the contract asks.
- **The file's license notice** is the `notice` field at the top of `stats.json`, with `license: "CC-BY-SA-4.0"` and `licenseUrl`:

  > Loop Troupe ride stats, compiled from Wikipedia (© Wikipedia contributors, CC BY-SA 4.0) and Wikidata (CC0 1.0); values selected, unit-converted, and normalized by Loop Troupe. This file is available under CC BY-SA 4.0.

  Keep the notice with any copy of the file, and keep `refs` with every coaster entry, because they carry the per-article attribution.
- **RCDB is not a source.** Nothing is fetched from rcdb.com. Wikidata's RCDB IDs are used only as matching evidence in `links.json`, and an infobox's `rcdb_number` is ignored. Where a Wikipedia value's inline citation points at RCDB, `cite` says `rcdb`, so the owner's Q-040 choice stays open.

## Files

| File | What it is | Shipped? |
| --- | --- | --- |
| `CONTRACT.md` | Copy of the stats file contract from `engineering_manager` (`docs/tech_spec.md` on `main` wins). | – |
| `fetch-wikidata.mjs` | Fetches Wikidata (five SPARQL queries) into `raw/`, and matches items to coaster IDs. Also a module that `fetch-wikipedia.mjs` imports. | No |
| `fetch-wikipedia.mjs` | Fetches English Wikipedia infoboxes into `raw/`, parses them, merges both sources, and writes every output below. | No |
| `stats.json` | The stats file, in the contract's shape, keyed by coaster ID. One coaster per line. | Candidate for `js/stats.json` |
| `links.json` | Coaster ID → Wikidata QID and Wikipedia article (title, revision, how it was matched), with confidence and evidence. | No (committed input) |
| `overrides.json` | Your choices where the sources disagree. Empty for now. | No (committed input) |
| `ambiguous.json` | Matches the scripts would not make on their own, from either source. A person decides. | No |
| `review.json` | Conflicts left out of `stats.json`, values that did not parse, and infobox values outside the contract (max vertical angle, status). | No |
| `coverage.md` | Coverage report. Generated, so don't edit it by hand. | No |
| `raw/` | Raw API responses (`wikidata-raw.json`, `wikipedia-raw.json`). Gitignored, per the contract. | No |

`wikidata-raw.json` was committed in 276af0e. It now lives in `raw/` and is untracked.

## Refresh

```sh
NODE_USE_ENV_PROXY=1 node spikes/coaster-stats/fetch-wikidata.mjs    # about 5 min: 5 queries, 65 s apart
NODE_USE_ENV_PROXY=1 node spikes/coaster-stats/fetch-wikipedia.mjs   # fetch Wikipedia, then build everything
node spikes/coaster-stats/fetch-wikipedia.mjs --offline              # rebuild from raw/ without fetching
```

You only need `NODE_USE_ENV_PROXY=1` behind an HTTPS proxy. Run fetches by hand, never from CI or a browser. The Wikipedia script sends the User-Agent `LoopTroupe-data/0.2 (https://github.com/glockstock/LoopTroupe)`; the Wikidata script sends version 0.1.

**Wikipedia fetch.** It uses the MediaWiki Action API at `https://en.wikipedia.org/w/api.php`, one request at a time, 3 s apart, with `maxlag=5`. On a 429 it waits for the server's `Retry-After` (at least 30 s) and retries. From this sandbox's shared address the API returned 429 often, so a full run took about 20 minutes.

1. `list=embeddedin` for `Template:Infobox roller coaster` (888 articles worldwide; articles using the template's redirects are included).
2. `prop=revisions&rvprop=ids|timestamp|content&rvslots=main&rvsection=0&redirects=1`, 50 titles per request, for those articles plus every English sitelink of the 635 US Wikidata items. Only section 0 is fetched, because it holds the infobox.
3. `raw/wikipedia-raw.json` keeps the revision ID, timestamp, and infobox wikitext (not the article text) of each page that is a US Wikidata sitelink or whose infobox names one of our parks or a US state.

## How values are matched and merged

**Wikidata** matching is unchanged from the first spike: a name match (label, Wikipedia title, or alias) plus location evidence (park, then city, then the state alone when the name is unique). See `method` in `links.json`.

**Wikipedia** matching has two stages:

1. **Through Wikidata.** For a coaster linked to a Wikidata item, the item's English sitelink is the article. The script uses the infobox whose location names the coaster's park (or the only infobox, if it gives no location), and checks the infobox name or article title against the coaster's name.
2. **Directly.** Every other infobox is matched by park and name. A match is accepted only when all of these hold:
   - the location names the park exactly (a disambiguator naming another state rules it out);
   - the infobox name or article title equals the coaster's name after normalization;
   - the match is unique on both sides.

   Matches through a previous name, a partial name, or a loose park name go to `ambiguous.json`.

**Rides that replaced another credit.** Sometimes an infobox's `previousnames` includes another coaster that `js/data.js` keeps as a separate credit at the same park: Top Thrill Dragster in the Top Thrill 2 article, or Mean Streak in Steel Vengeance. Then:

- The infobox's figures go only to the ride it is named for.
- Any value that is footnoted (`{{efn}}`) or qualified ("(as …)", several lines) is dropped, because it may describe the earlier ride. Top Thrill 2's designer is dropped this way, because a footnote ties it to the 2003 ride.
- The earlier ride (`cedar-point--top-thrill-dragster`) gets nothing from the article. The Wikidata item, labelled "Top Thrill 2" but dated 2003–2022, stays in `ambiguous.json`, so Top Thrill 2's values come from Wikipedia only.

**Parsing.** The parser reads only the template's own parameters: `height_ft`/`height_m`, `drop_ft`/`drop_m`, `length_ft`/`length_m`, `speed_mph`/`speed_km/h`, `inversions`, `gforce`, `duration`, `angle`, `manufacturer`, `designer`, `model`, `type`/`type2`/`type3`, `opened`, `closed`, `status`, `previousnames`, and `location`. It first removes comments, `<ref>`s, and maintenance tags, then accepts only these forms:

- a figure: a single plain number (`310`, `1,200`, `62.5`), the number with the parameter's own unit (`205 ft`), or `{{convert|N|unit|…}}` in the parameter's unit;
- inversions: a whole number, or "None";
- G-force: one number, optionally with `g`, or `{{val|N|u=g}}`;
- duration: `m:ss`, "N seconds", "N minutes", "N minutes N seconds", or `{{duration|…}}`;
- dates: `{{Start date|Y|M|D}}` (also `Start date and age` and `End date`), "May 26, 2007", "26 May 2007", "May 2007", or a year, and never a future date;
- manufacturer, designer, model: one name, with links removed.

Anything else is left out and listed in `review.json` with its raw text: ranges, "approx.", two dates, a unit that contradicts the parameter, several names, or an unknown template. When both the imperial and metric parameters are filled, they must agree, and the imperial one is kept.

**Merging.** Each field keeps one value, with `src` naming its source and `refs` holding the provenance (`wd`: QID and retrieval date; `wp`: article title, revision ID, and retrieval date).

- **Both sources agree:** Wikipedia supplies figures, names, and type, because it holds the published imperial figures and common company names. The more precise source supplies dates, and Wikidata wins a tie.
- **Agreement allows for rounding.** Each figure stands for an interval of its last digit (53 m means 52.5–53.5 m), and two intervals that overlap within 0.5% agree. So Wikidata's 53 m and Wikipedia's 175 ft for X2 agree, while Wicked Twister's 689 ft and 675 ft do not. Dates agree when they match at the coarser precision. Company names agree on their first distinctive word ("Intamin Amusement Rides Int. Corp. Est." and "Intamin").
- **Conflicts** (both sources have the field and disagree) are left out of `stats.json`. They are listed, with both raw values, in `coverage.md` and `review.json` until `overrides.json` records a choice. Make that choice by checking the primary source that either value cites.
- **Implausible values** outside the contract's ranges are left out as likely unit mix-ups.

## Units

Values are stored metric, as the contract asks. `v` is in meters, km/h, or seconds, converted with exact factors (1 ft = 0.3048 m, 1 mph = 1.609344 km/h) and rounded to 3 decimals.

`pub` is the figure as the source states it (`[310, "ft"]`), and the site shows it verbatim. Durations are always given in seconds, so `2:30` becomes `[150, "s"]`, and Wikidata durations stored in minutes become seconds. A Wikidata figure in any other unit (m/s, km) is left out, because `pub` must be in m, ft, km/h, mph, or s.

## Limits

- **Coverage is still partial.** 533 coasters have no value: neither a Wikidata item nor a Wikipedia infobox matched them, or the match is waiting in `ambiguous.json`. Some articles are about a relocated ride now at another park, or a clone at another park, and are correctly rejected. Some parks are renamed on Wikipedia (Six Flags St. Louis rides now list "Mid America Adventure"), and those rides wait in `ambiguous.json`.
- **Dual-track coasters** (Gemini) use a different template, `Infobox dual roller coaster`, with figures for each track. It isn't parsed.
- **File size.** `stats.json` is about 271 KB uncompressed and 39 KB gzipped. That is under the contract's 64 KB gzip budget but over its 256 KB uncompressed budget. Moving `retrieved` and `lang` out of each coaster's `refs` to the top of the file would save about 27 KB. That is a contract change for `engineering_manager`.
- **G-force** comes only from Wikipedia's `gforce` parameter. Park and manufacturer figures are not openly licensed, and we don't use them.
- **Max vertical angle and status** are parsed but are not in `stats.json`, because the contract says to ask before adding a field. They are in `review.json` under `extraFields`.
- **`cite`** is filled only where the infobox value carries its own `<ref>`. Most infobox values have no inline reference, and the article body may still cite them, so they get no `cite` rather than `none`. A value whose reference is a named reference defined elsewhere in the article also has no `cite`.
- **Freshness.** Wikipedia values are current to the revision in `refs.wp`. Wikidata lags: it has no closing date for X2, which Wikipedia gives as 2026-07-12.
- **Type vocabularies differ.** Wikipedia's `type2`/`type3` ("Launched", "Inverted") and Wikidata's classes ("inverted roller coaster") are both stored as `type`, from whichever source supplied it.

## Spot-check against Wikipedia (2026-10-02, from the first spike)

| Coaster | Wikidata | Wikipedia infobox | Result |
| --- | --- | --- | --- |
| Millennium Force | 310 ft, 6,595 ft, no speed | 310 ft, 6,595 ft, 93 mph | Agrees; Wikidata lacks speed (Wikipedia also gives G-force 4.5) |
| Kingda Ka | 456 ft, 128 mph, 3,118 ft, 28 s, closed 2024-11-10 | Same | Agrees |
| Maverick | 105 ft, 113 km/h (70.2 mph), 1,356.4 m (4,450 ft), 150 s | 105 ft, 70 mph (110 km/h), 4,450 ft, 2:30 | Agrees within rounding |
| The Incredible Hulk Coaster | 110 ft, 67 mph, 3,700 ft, 135 s | Same | Agrees |
| X2 | 53 m (174 ft), 122 km/h (75.8 mph), 1,100 m (3,609 ft) | 175 ft, 76 mph, 3,610 ft; closed 2026-07-12 | Agrees within rounding; Wikidata lacks the 2026 closure |
| Wicked Twister | 215 ft, 72 mph, 689 ft (preferred rank) | 215 ft, 72 mph, 675 ft | Length disagrees (689 vs 675 ft); closing date 2021-09-06 vs 2021-09-07 |
