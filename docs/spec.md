# Loop Troupe — Product Spec

Owner: `product_manager` (sole editor; see AGENTS.md). Status as of 2026-10-02.

How to read this spec: **Approved direction** is what the owner has asked for. **Proposed** items are the product team's recommendations and are not commitments until the owner confirms them (tracked in `docs/open_questions.md`). **Shipped** is what is live today.

## Owner direction

The user's own words. Preserve verbatim; organize derived requirements below.

> "This should be a website that allows roller coaster enthusiasts to track their 'credits' a term for the coasters they've ridden. They can see every coaster in every park in America to start. They can log that they rode it and leave a review of that ride. Make this a beautiful website. Host this on my GitHub io pages."

> "Make sure this is mobile friendly. Also make the visual style in the style of roller coaster tycoon, the video game. The pixel art of the coasters, isometric views of them when you visualize the park, and the fonts and colors schemes that add whimsy."

> "I want a retro feel, like roller coaster tycoon, but the current page could be improved."

> "It'd be cool to be basically a credits app + a guide app. The credits app is free, builds community. You log in and log your rides. The Goodreads of roller coasters.
>
> The guide part is paywalled. We curate a list of parks that we offer comprehensive guides to. When to go, which gates to use, what rides are must hit, best food, etc etc. We could probably start by basically skimming blogs and horrendous YouTube videos that normal people don't want to watch.
>
> Some notes:
>
> 1. we could probably improve the guide part by having some kind of community forum. im guessing a similar kind of forum already exists but might be janky
> 2. https://cannoneyed.com/isometric-nyc/
>
> Can't remember if i shared before, but it's one of the few cases where i thought AI generated "art" was done in an interesting way. They basically recreated NYC in a simcity style (using satellite imagery i believe).
>
> I thought this could be a cool way to semi-automatically generate the park maps, but i'm guessing it's not a simple process and might not translate well to coasters. I wonder if we could create some kind of interactive map based on YouTube videos of the park.
>
> https://play.mint.gg/complete-shelf
>
> What if we did something similar where when people click into a park they can video a virtual model of the park, then they can click into a specific ride and view a 3d model of that along with various speed, G force, etc on the ride. And there are little tiny animations in the virtual park model, like you see a cart going down a drop, etc. Then you click in and it zooms in to the map. And attach the best videos available online."

> Reply to the team's recommended plan (spec update, accounts/payments options, OpenStreetMap map spike): "Start all three, but do share the plan with me."

Reply on 2026-10-02 to five decisions put to the owner: (1) start with the Cedar Point guide test before building accounts? (2) PDF or web page for the first guide? (3) can you, or someone you trust, visit Cedar Point to fact-check the guide each season? (4) allow a third-party checkout and simple sales counts for the test? (5) which map data source for the spike?

> "1. Yes start with Cedar Point
> 2. Let's do a mobile web guide. We might pivot to PDF later but let's start with everything in the site. I don't care that the GH is public for now, we can sort that out later.
> 3. Yes! My friends who I'm running this project with and I just visited and I've been there twice.
> 4. I'm not worried about monetization and checkout logic just yet.
> 5. I'm not sure how to answer this, I'll defer to you."

Earlier repository tagline: "Loop Troupe: Goodreads for roller coasters."

Later on 2026-10-02 the owner set a new focus, then was asked what "the free functionality" should focus on first (a better credits app now with no login, accounts and community, or both in parallel) and which backend to plan accounts around.

> "I want to focus on the park map spike and and the free functionality"

> "Better credits app now. The parks should show the actual layout of the park. Some ideas in there:
>
> https://cannoneyed.com/isometric-nyc/
> Can't remember if i shared before, but it's one of the few cases where i thought AI generated "art" was done in an interesting way. They basically recreated NYC in a simcity style (using satellite imagery i believe).
>
> I thought this could be a cool way to semi-automatically generate the park maps, but i'm guessing it's not a simple process and might not translate well to coasters. I wonder if we could create some kind of interactive map based on YouTube videos of the park.
>
> https://play.mint.gg/complete-shelf
>
> What if we did something similar where when people click into a park they can video a virtual model of the park, then they can click into a specific ride and view a 3d model of that along with various speed, G force, etc on the ride. And there are little tiny animations in the virtual park model, like you see a cart going down a drop, etc. Then you click in and it zooms in to the map. And attach the best videos available online."

On the backend question ("When accounts do come, which backend should the engineering manager plan around?") the owner chose the option "Decide later": keep the free side without login for now.

Later on 2026-10-02, after the map and stats spikes, the owner answered three multiple-choice questions. These are chosen options, not the owner's free text; the option wording is quoted as it was put to them.

- Asked "Put the real OpenStreetMap layout on park pages, starting with Cedar Point? Going live means publishing the map data under OpenStreetMap's open license (ODbL) with a credit line on every map," the owner chose **"Yes, Cedar Point first."** The option said: "Polish Cedar Point to ship quality (better contrast for unridden coasters, smoother phone panning, per-park default view), put it on the park page, then add the other 4 parks one by one. Every other park keeps today's diorama. Map data is published openly with attribution, as the license requires."
- Asked "The ride zoom-in and '3D model' you described: what style?", the owner chose **"Pixel now, 3D trial later."** The option said: "Ride pages get a pixel-art zoom-in that matches the maps now. After that ships, the art director tries a chunky voxel/low-poly 3D version of one ride in our retro palette; it only goes live if you like it. Any 3D ride is an artist's interpretation (no open data has real track heights or loops)."
- Asked "Where should ride page stats (height, speed, length, inversions, G-force) come from?", the owner chose **"Wikidata + Wikipedia."** The option said: "Wikidata (public domain) plus Wikipedia ride infoboxes, which have far more stats including G-force for some rides. Wikipedia's license (CC BY-SA) means crediting Wikipedia on ride pages and offering the stats file under the same license. Missing values are shown as missing, never guessed."

## Vision

Loop Troupe is two things under one retro theme-park roof:

1. **A free credits app.** The Goodreads of roller coasters: riders log every coaster they ride, review it, see their rides on the real layout of each park, and watch their riding life add up. This side builds the community. It works without signing in today; accounts come later.
2. **Park guides (paid eventually).** A curated set of parks with comprehensive, current guides: when to go, which gate to use, which rides are must-hits, where to eat, and more. We dig through scattered blogs and long videos so riders don't have to, and the people who ride these parks check every claim. The owner's long-term intent is a paywall; for now guides are free while we make the first one excellent.

The halves reinforce each other. The credits log knows which coasters a rider still needs; a guide tells them how to get those credits on the next trip; community knowledge keeps the guides fresh.

## Audience

- **Credit counters (free side):** enthusiasts who track credits, plan trips around new coasters, and like seeing and sharing their progress. Core moments: logging a ride from a queue on a phone, back-logging a riding history at home, looking back.
- **Trip planners (paid side):** anyone planning a day at a coaster-heavy park who wants a smarter plan than the park map: enthusiasts on a credit run, regulars visiting a new park, thrill-seeking groups and families.
- *Assumption to test (later):* guide buyers overlap with credit counters but are not the same group. Hardcore enthusiasts may already know the parks; casual visitors may value a guide more but never log a credit. With monetization deferred, the first guide no longer measures who buys; direct feedback from invited readers gives an early, qualitative read.

## Team

- **The owner** is the product owner and final authority. They run Loop Troupe with a small group of friends (**the owner's team**), who are themselves coaster enthusiasts and the product's first users.
- **First-hand knowledge.** The owner has visited Cedar Point twice, most recently with the team (stated 2026-10-02). The team is the guide's verification source: they confirm claims from their visits and sign off before anything goes live, and they can revisit to fact-check each season.
- **The specialist agents** (AGENTS.md) research, draft, build, and review. They never mark a guide claim verified; only the owner's team does.
- How team members want to be credited publicly (the repository is public) is open (Q-028).

## Market context (checked 2026-10-02)

Facts are sourced; lines marked *Read* are our interpretation. apps.apple.com, deeparrival.com, and rideready.app were blocked by this environment's network policy, so some figures come from search-result summaries and need a direct check.

- **Credits logging is crowded and mostly free.** Captain Coaster (free ratings and rankings, 14,000+ users by its own count), LogRide (Pro tier about €10.49/yr for stats and backdating), Loopr, Coasterly, and Coaster-Count. ([Captain Coaster](https://blog.captaincoaster.com/about), [CoasterForce thread](https://coasterforce.com/forums/threads/best-websites-to-count-rank-coasters.45438/), [Loopr](https://apps.apple.com/us/app/loopr-roller-coaster-tracker/id6670705734), [Coasterly](https://apps.apple.com/bf/app/coasterly/id6748962807), [LogRide](https://apps.apple.com/us/app/logride-theme-park-tracker/id1413056392))
  *Read:* the free side must win on feel, delight, and its link to guides, not on feature count.
- **Paid planning exists for destination parks.** TouringPlans covers Walt Disney World (about $25/yr), Universal Orlando (about $12/yr), Disneyland (about $10/yr), and Disney Cruise Line. ([TouringPlans](https://touringplans.com/walt-disney-world/join))
- **Regional coaster parks are not empty.** Ride Ready covers 15 parks, including Cedar Point, Kings Island, Carowinds, Kings Dominion, several Six Flags parks, Canada's Wonderland, Busch Gardens, and Dollywood. It sells live waits, day plans, and alerts (reported $24.99 per 14-day Trip Pass, or monthly) and publishes free crowd calendars and strategy pages. Official park apps are free with maps and waits; wait-time history is free (queue-times.com, thrill-data.com); free blog guides are plentiful. ([Ride Ready](https://rideready.app/), [Cedar Point official app](https://apps.apple.com/us/app/offline-guide-cedar-point/id903730552), [queue-times](https://queue-times.com/parks/50/stats/2025), [Undercover Tourist](https://www.undercovertourist.com/blog/guide-cedar-point-ohio/))
  *Read:* "nobody serves regional parks" is not true. Our wedge is **enthusiast-grade, opinionated guides linked to your credit log** (which credits you still need, the order to get them, best seats, quirks), not live waits or generic tips. Whether people pay for a guide when free blogs exist remains the central unknown for the paid side; the owner has deferred testing it, so the guide track first builds an excellent guide, free.
- **Forums exist.** CoasterForce, CoasterBuzz, park boards such as KI Central, Theme Park Review, r/rollercoasters. ([CoasterBuzz](https://coasterbuzz.com/Forums/Topic/cedar-point-early-entry-strategy/2), [KI Central](https://kicentral.com/forums/topic/18737-my-thoughts-on-cedar-point-vs-kings-island/))
- **Open map data exists.** OpenStreetMap has coaster tagging (`roller_coaster=track`, `=station`, `=support`). ([OSM wiki](https://wiki.openstreetmap.org/wiki/Tag:roller_coaster=track)) The map spike (branch `spike/osm-park-map`) linked real coaster track to our coaster IDs at five parks: Cedar Point 18 (every operating coaster), Six Flags Magic Mountain 16, Kings Island 14, Dollywood 8, Knoebels 5. Known gaps: generic ride shapes, low contrast for unridden coasters at overview, and 30–90 ms frames when panning. Coverage elsewhere is unverified. OSM data is under the Open Database License, which requires attribution and share-alike for derived databases.
- **Open ride stats are partial.** The Wikidata spike (branch `spike/coaster-stats`; Wikidata is CC0, public domain) matched 462 of our 1,024 coasters. Manufacturer and type are good; height, speed, and length are on only about 4% of our coasters; Wikidata has no property for inversions or G-force. English Wikipedia's roller-coaster infobox carries more, including a G-force field (the spike found a numeric value in 311 of about 888 infobox articles worldwide; US coverage is a subset and not yet measured). Wikipedia is CC BY-SA 4.0 (attribution and share-alike). The best-known stats database, RCDB, is copyrighted and off limits.

## Approved direction

What the owner has asked for. Where later direction changes earlier direction, the later wins and the change is noted. Specific approaches (how we build it, and in what order within a track) are the product team's and live in the Roadmap.

### Current focus (2026-10-02, latest)

- **The free credits app, without login, comes first.** Owner: "I want to focus on the park map spike and and the free functionality," then chose "Better credits app now": make the free tracker more compelling with no login. The examples in the option the owner picked were richer stats and milestones, top-10 rankings, trip logs, shareable credit images, and faster back-logging. The scope and order are in Roadmap, "Now: the free credits app."
- **Park pages show the actual layout of the park.** Owner: "The parks should show the actual layout of the park." Interactive, with "little tiny animations" (a car going down a drop), and clicking in "zooms in to the map" on a ride. The product team's approach: pixel-isometric maps generated from OpenStreetMap, with today's procedural dioramas everywhere a real map has not gone live.
- **Real OpenStreetMap maps go live, Cedar Point first (2026-10-02).** Owner chose: "Yes, Cedar Point first." Approved: polish Cedar Point's map to ship quality (better contrast for unridden coasters, smoother phone panning, a per-park default view), put it on the Cedar Point park page, then add the other four spike parks (Kings Island, Dollywood, Six Flags Magic Mountain, Knoebels) one at a time. Every other park keeps today's diorama. Map data is published openly under the ODbL with a credit line on every map (resolves Q-035). Which parks come after the five is still open (Q-037, C1c).
- **Every ride gets its own page.** Clicking into a ride shows its stats (the owner named speed and G-force) and "the best videos available online."
- **Ride pages: pixel zoom-in now, 3D trial later (2026-10-02).** Owner chose: "Pixel now, 3D trial later." Approved: ride pages get a pixel-art zoom-in that matches the maps now. After that ships, `art_director` tries a chunky voxel or low-poly 3D version of one ride in the retro palette; it goes live only if the owner likes it. Any 3D ride is an artist's interpretation, because no open data has real track heights or loops, and is presented as one (resolves Q-012).
- **Ride stats come from Wikidata plus Wikipedia (2026-10-02).** Owner chose: "Wikidata + Wikipedia." Approved: stats come from Wikidata (CC0) and English Wikipedia ride infoboxes (CC BY-SA), including G-force where Wikipedia has it. Ride pages credit Wikipedia, and the stats file is offered under CC BY-SA. Missing values are shown as missing, never guessed (resolves Q-036).
- **Accounts and the backend are deferred.** Owner: "Decide later." The free side stays without login for now; riders' credits stay in their browser. Accounts remain the long-term direction ("You log in and log your rides"), but they are not scheduled and no backend is chosen (Q-001). This replaces the earlier order in which accounts followed the first guide.
- **The Cedar Point guide continues on its own track.** It now waits on the owner's team to verify it, and runs in parallel with the credits-app work rather than ahead of it. Nothing about the guide is dropped.

### Still in force (earlier direction)

- **Paywalled, curated park guides (long-term).** A curated list of parks, each with a comprehensive guide: when to go, which gates to use, must-ride rides, best food, and similar practical advice. Research may draw on blogs and YouTube (see Guide content policy).
  - **Paywall deferred (2026-10-02).** The owner is "not worried about monetization and checkout logic just yet." The first guide ships free. No pricing, checkout, or analytics/measurement work until the owner reopens it (Q-007, Q-010, Q-020, Q-027).
- **Cedar Point is the first guide (2026-10-02).** Next parks are open (Q-008).
- **Guides are mobile web pages inside the site (2026-10-02).** Not a PDF for now ("We might pivot to PDF later"). The owner accepts that guide content is public in the GitHub repository for now; protection is revisited later.
- **First-hand verification by the owner's team (2026-10-02).** The owner and their friends have visited Cedar Point and will fact-check the guide each season. The team signs off before a guide goes live (workflow in `docs/guides/cedar-point-brief.md`).
- **Unchanged:** US parks to start; retro theme-park-sim look; mobile friendly; GitHub Pages hosting until the owner approves a change; ride data never leaves the rider's browser without explicit owner approval.

### Owner interest, recorded but not scoped

- **A "virtual model of the park" and "a 3d model" of each ride.** The owner has described this twice, pointing to play.mint.gg/complete-shelf as inspiration. Now partly scoped (2026-10-02): the pixel zoom-in and a later stylized 3D trial of one ride are approved (Current focus). A 3D model of a whole park, 3D for every ride, and a realistic 3D look are not scoped; realistic 3D would depart from the approved retro direction.
- **Semi-automatically generated maps, like Isometric NYC.** The owner liked how cannoneyed.com/isometric-nyc recreated a city in a sim-game style. We are pursuing the same goal procedurally from OpenStreetMap data rather than by restyling satellite or map imagery, which carries terms-of-service problems (spike notes in `spikes/osm-park-map/README.md` on its branch).
- **"Some kind of interactive map based on YouTube videos of the park."** Recorded as owner interest. We will not download YouTube videos or extract frames from them to derive map data: YouTube's Terms of Service forbid downloading content except where YouTube expressly allows it, and forbid automated access such as scrapers. Videos stay official, tap-to-load embeds with creator credit (Guide content policy, item 3). A person on the team may still watch a public video as ordinary research to hand-correct a map detail (for example, which way a train leaves the station), and the owner's team may use its own photos and footage freely.
- **Community input that improves guides** ("some kind of community forum"; Q-011).

### Exploration (not commitments)

- **OpenStreetMap park map spike: done** (`art_director`, `coaster_data_curator`, branch `spike/osm-park-map`). Real layouts for the five pilot parks in the pixel-isometric style, with ridden coasters colored (results in Market context). The owner approved taking it to production, Cedar Point first (C1b). The main OSM API works for a handful of small requests, which is fine for the pilot parks but not for all 298 parks under OSM's usage policy (Q-034).
- **Open ride-stats spike: done** (`coaster_data_curator`, branch `spike/coaster-stats`). Wikidata coverage measured (results in Market context). The owner approved Wikidata plus Wikipedia as the stats sources (C1a). Next: measure Wikipedia infobox coverage for our US coasters.
- **Accounts, backend, and payments options** (`engineering_manager`, `docs/proposals/accounts-and-payments.md`): reference only, paused while accounts are deferred (Q-001).

## Positioning (proposed)

"Log every coaster for free. Unlock the insider guide to your next park." `product_marketing_manager` owns external messaging. While guides are free, "unlock" does not apply; a free-guide variant such as "Log every coaster. Get the insider guide to your next park." is a suggestion for `product_marketing_manager` to confirm.

## Business model (proposed; deferred by the owner on 2026-10-02)

Kept for when the owner reopens monetization. Nothing here is being built now.

- **Free:** credits logging, reviews, profiles, progress, community tips, and curated video picks.
- **Paid:** our original park guides. Model and price pending (Q-007). Reference points: TouringPlans about $10–25/yr per destination; Ride Ready $24.99 per 14-day pass. Recommended for the deferred paid test: a one-time purchase of one park guide at about $9, good for the season.
- **No ads and no sale of rider data** (recommended; Q-014).

## Roadmap (re-sequenced 2026-10-02)

The owner set the current focus on 2026-10-02: the free credits app without login, including real park maps, comes first; accounts wait ("Decide later"). The Cedar Point guide keeps going on its own track. **Approved** below means the owner asked for it; **proposed** means it is the product team's recommendation, which the owner can change.

### At a glance

| When | Track | Status | What |
| --- | --- | --- | --- |
| Now | **Free credits app, no login** | Focus approved 2026-10-02. C1's map order (Cedar Point, then the other four spike parks one at a time), pixel ride zoom-in, and stats sources approved 2026-10-02. Order of C2–C6 is proposed by `product_manager`. | C1 real park maps and ride pages (owner-named, first); then C2 faster back-logging, C3 stats and milestones, C4 top-10 rankings, C5 shareable credit images, C6 trip logs |
| Now, in parallel | **Cedar Point guide** | Approved. Built as an unpublished draft; waiting on the owner's team to verify it. | Verification, sign-off, go-live (Q-030) |
| After the pixel zoom-in ships | **3D trial** | Approved 2026-10-02 ("Pixel now, 3D trial later"); goes live only if the owner likes it | `art_director` tries a chunky voxel or low-poly 3D version of one ride in the retro palette |
| Later | **Accounts and community credits** | Approved direction, deferred by the owner ("Decide later"); backend not chosen (Q-001) | Sign-in, cloud-saved credits, public profiles and reviews |
| Later | **Community tips and more guides** | Proposed (Q-008, Q-011) | Structured tips; 2–4 more guide parks |
| Later | **Guide layers on park maps** | Proposed | Gates, food picks, and ride-order routes from a guide drawn on its park's map |
| Deferred by the owner | **Paid guide test** | Deferred (Q-007, Q-010, Q-020, Q-027) | Kept below for when monetization returns |

Older documents use phase numbers. They map as follows: Phase 1 is the Cedar Point guide; Phase 2 is accounts and community credits; Phase 3 is community tips and more guides; Phase 4 (generated park maps) moved into the credits app now as C1, apart from guide layers; Phase 5 (ride zoom-in) moved into C1 in pixel-isometric form; the 3D trial follows it (approved 2026-10-02).

### Now: the free credits app (focus and C1 approved 2026-10-02; order of C2–C6 proposed)

- **Goal:** make Loop Troupe the most delightful place to keep your coaster credits without signing in. See your rides on the real layout of each park, open any ride for its stats and best videos, and watch your riding life add up.
- **Why now:** the owner asked for it. It also matches the market: credits logging is crowded and mostly free, so the free side wins on feel and delight, not feature count (Market context). *Assumption:* no competitor offers animated, real-layout park maps in a retro game style; we have not checked every app.
- **Who it's for:** credit counters, starting with the owner's team, who are the first users.

**Rules for every item in this track**

1. **No login and no backend.** Ride data stays in the rider's browser. Nothing a rider logs is sent anywhere. New fields (for example a top-10 list) are included in backup export and import.
2. **Credits are safe.** Coaster IDs never change. New storage is additive, and existing logs are never lost or overwritten. Any change to the ride-log storage schema is a big change under AGENTS.md: `engineering_manager` proposes it and the owner approves it first.
3. **Logging stays fast.** Marking a coaster ridden from a park page stays one tap. Maps, animations, and ride pages never sit in the way of logging.
4. **No third-party requests on page load.** Map and stats data are built ahead of time and shipped with the site. Riders' browsers never call OpenStreetMap, Wikidata, or Wikipedia. Videos load only when tapped.
5. **Honest data.** Decorative art (a coaster's silhouette, a map's estimated hill heights, a 3D interpretation) is never presented as ride data. Stats come only from the approved sources (Wikidata and Wikipedia), with the source shown. Missing values are shown as missing, never guessed or estimated. No data is copied from copyrighted databases such as RCDB.
6. **The retro look, accessible.** Pixel-isometric, in the design guide's palette. Works at 390px, by keyboard, and with screen readers. Animations stop under `prefers-reduced-motion`.

**Priority order.** C1 is first because the owner named it; within C1, Cedar Point's map goes live first and the other four pilot parks follow one at a time (approved 2026-10-02). The order of C2–C6 ranks rider value. Back-logging comes first because every other feature depends on a rider's history being entered.

#### C1. Real park maps and ride pages (first; owner-named)

Two parts that link to each other. **C1a ride pages** can ship for every coaster without map data. Build them first or alongside the C1b pilot, because they are where a map tap lands.

**C1a. Ride pages** (new route `#/coaster/<coaster-id>`, using the existing stable coaster ID)

Requirements:

1. **Reachable from everywhere a coaster appears:** park pages, the A–Z index, My Credits, search results, guides, and a tap on the park map. An unknown ID shows a friendly "ride not found" page with a way back.
2. **Header:** the coaster's name, its park (linked), and the state. Its operating or retired status is shown only once the data supports it (Q-029).
3. **Your ride:** the rider's own log in place. That means the ridden toggle, first-ride date, times ridden, star rating, and review, edited with the existing log dialog. Logging from the ride page is as fast as from a park page.
4. **Pixel zoom-in (approved 2026-10-02, "Pixel now, 3D trial later"):** a pixel-art zoom-in on this coaster that matches the maps, with a small animation (the train climbing and dropping), colored in when ridden and gray when not. Where the park has a real map, it is a zoomed view of the coaster from that map. Where it does not, it is today's diorama sprite, enlarged and animated, in the same pixel style. It is decorative and never implies the ride's real shape or type. A stylized 3D view of one ride follows later as a trial (see "After the pixel zoom-in ships: the 3D trial").
5. **Stats (sources approved 2026-10-02, "Wikidata + Wikipedia"):** height, drop, speed, length, inversions, G-force, manufacturer, type, opening year, and wood or steel.
   - **Sources:** Wikidata (CC0) and English Wikipedia ride infoboxes (CC BY-SA 4.0), linked to our coaster IDs through a curated table (no runtime name matching). Expect inversions and G-force to come only from Wikipedia, and G-force to be present for a minority of rides.
   - **Missing values are shown as missing, never guessed.** A stat with no value from either source is shown with a clear "not known" marker (wording by `ux_content_designer`), not hidden and never estimated. A ride with no stats at all says so in one line rather than showing a grid of blanks (layout by `product_designer`).
   - **Disagreements:** where Wikidata and Wikipedia disagree, `coaster_data_curator` decides which value is right, checking the primary source either one cites (for example the park's or manufacturer's page), before it ships; an unresolved conflict is shown as missing. We never look values up in RCDB or another database whose terms forbid reuse (Q-040).
   - **Credit and license:** each value shows its source. Every ride page that shows a Wikipedia value credits Wikipedia and links to the article. The stats data ships in its own file, separate from `js/data.js`, and is offered under CC BY-SA 4.0 with a notice saying so. Wikidata is credited as good practice although CC0 does not require it.
   - US units first (feet, mph), with metric alongside.
6. **Best videos:** up to three hand-picked videos, on-ride POV first, then the best review or history video. Each uses the platform's official embed and loads only when the rider taps it. The creator's name and a link to the original are always shown. No downloading, clipping, or re-hosting (Guide content policy, item 3). Coasters with no picks yet show no empty video box. How picks scale beyond pilot parks is Q-038.
7. **Phone first:** the page works at 390px, with "Your ride" near the top, stats compact, and videos below.

Acceptance:

- Every coaster in `js/data.js`, including defunct coasters, has a working page. Existing credits show correctly on it, and logging from it updates the park page, My Credits, and the map at once.
- Each stat shown traces to Wikidata or Wikipedia with its date checked. Missing values show as missing on every page. `coaster_data_curator` spot-checks 20 pages with no errors. No page shows an estimated value as fact.
- Every page with a Wikipedia value carries the Wikipedia credit and article link, and the stats file is published with its CC BY-SA notice.
- Video picks follow the content policy. Nothing loads from a video platform until the rider taps.
- `qa_engineer` passes it with no change to existing ride logs or backups. `product_designer` reviews the page. `ux_content_designer` reviews the copy.

**C1b. Real park layouts on park pages** (approved 2026-10-02, "Yes, Cedar Point first": Cedar Point, then the other four spike parks one at a time)

Order and polish:

- **Cedar Point first.** Before it goes live, polish the spike's Cedar Point map to ship quality: better contrast for unridden coasters at overview, smoother panning on phones, and a per-park default view. Then it replaces the diorama on the Cedar Point park page.
- **Then the other four, one at a time.** Kings Island, Dollywood, Six Flags Magic Mountain, and Knoebels each go live separately, each passing the acceptance bar below on its own. Proposed order: Kings Island, Six Flags Magic Mountain, Dollywood, Knoebels (Kings Island is flat and well linked; Magic Mountain and Dollywood are hillside parks that need terrain work; Knoebels has the fewest coasters). `product_manager` may reorder for team visits or readiness.
- **Every other park keeps today's diorama.**
- **Generic ride shapes** (a known spike gap) do not block go-live as long as the layout is recognized and the shapes stay decorative; per-type silhouettes are later polish within the approved look.

Requirements:

1. **Real layout where coverage allows.** A park page shows an interactive pixel-isometric map of the park's actual layout, generated from OpenStreetMap and hand-corrected by `coaster_data_curator` and `art_director` (ride direction, station, height cues). A park without a map that meets the bar keeps today's procedural diorama. The diorama is never labeled or described as the real layout.
2. **Your credits on the map.** Ridden coasters show in their track color and unridden ones as gray ghosts, matching the rest of the site. Logging a ride colors it in immediately.
3. **Tap a ride to zoom to it.** The map highlights the coaster, steps in to it, and shows its name, ridden status, and a link to its ride page. Pan, pinch or step zoom, and a reset view work by touch, mouse, and keyboard. A list of the park's coasters next to the map gives an accessible path to every ride.
4. **Little animations.** Trains run their circuits: slow on the lift, quick down the drops, pausing in the station. Under reduced motion the trains park and the zoom jumps instead of stepping.
5. **Coverage is visible.** Every operating coaster in `js/data.js` for that park is on the map, or marked as a signpost or listed as "not on the map yet." The map never hides a credit.
6. **Credit and licensing (approved 2026-10-02).** A credit line, "© OpenStreetMap contributors" linked to the OSM copyright page, is shown on every map. Map data, including our curated fixes layered on it, is published openly in its own file per park under the ODbL, separate from `js/data.js`.
7. **Built ahead of time.** Map data is fetched and processed outside the site, within OSM's usage policies, and never fetched from riders' browsers (Q-034).

Acceptance (per park, before its map goes live):

- A member of the owner's team (or, for a park the team doesn't know, a regular visitor) recognizes the layout and confirms the coasters are in the right places.
- Every operating coaster appears or is clearly listed as missing, and each one on the map links to the right coaster ID through a curated link table, not runtime name matching.
- At 390px on a mid-range phone the overview is legible, with unridden coasters clearly visible against the ground; zoom and pan work one-handed and smoothly; the default view frames the park's coasters; and the page meets a load and frame-rate budget set by `web_performance_engineer` (the spike's 30–90 ms frames while panning do not meet it). Logging from the park page is no slower than today.
- The OSM credit line shows on the map at every width, and the park's map-data file is published with its ODbL notice.
- `product_designer`, `motion_ux_engineer`, and `qa_engineer` have reviewed it. `product_experience_reviewer` has walked "open a park, find a ride, log it, open its page" with no unresolved blocking findings.

**C1c. More parks.** After the five pilot parks, add real maps in the order set by Q-037 (still open). Proposed: parks with the most coasters, parks the owner's team visits, and the next guide parks. Each park must pass the same bar, and the procedural diorama remains for the rest. Scaling to all 298 parks depends on a bulk data path that respects OSM's usage policy (Q-034).

#### C2. Faster back-logging (recommended first upgrade)

- **Why:** a new rider with 100 or more credits must enter their history before stats, maps, milestones, or sharing mean anything. Today they tap coaster by coaster across parks. This is the biggest gap between signing up and seeing the payoff.
- **Requirements:** a back-log mode on each park page, where the rider ticks every coaster ridden there and saves once. They can set one date for the batch, or leave it blank ("date unknown"). Search across all coasters adds a credit in at most two taps from a result. The last batch can be undone. Defunct coasters are included for legacy credits.
- **Acceptance:** a team member on a phone enters 100 credits across 15 parks in under 10 minutes. A batch never overwrites an existing log's date, count, rating, or review; it only adds. Undo restores the exact prior state. `qa_engineer` passes it.
- **Later, not now:** importing from other apps' exports (name matching is error-prone; revisit with `coaster_data_curator`).

#### C3. Stats and milestones (recommended second)

- **Why:** the North Star is riders feeling proud of their count. Milestones turn a number into moments, and they work with today's data.
- **Requirements:** a stats view with credits by year (from first-ride dates), by state, and by park; parks completed; and total rides. Wood versus steel and manufacturer appear once the ride stats data (C1a) covers enough coasters. Milestones include credit counts (1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, and so on), first and fifth completed park, number of states, and a first defunct (legacy) credit. Each is marked with a small pixel celebration that never blocks logging. Milestones are computed from local data, so they appear after back-logging. A big back-log shows one summary rather than twenty pop-ups.
- **Acceptance:** numbers match My Credits exactly. Milestones appear for history entered in bulk and survive backup and restore. Credits are counted per coaster ID (relocations follow Q-002). The copy is reviewed by `ux_content_designer`.

#### C4. Top-10 rankings

- **Why:** ranking rides is core enthusiast behavior and the most shared list in the hobby.
- **Requirements:** the rider orders up to 10 ridden coasters, starting from a suggestion based on their star ratings, and reorders them with move up and move down controls that work by keyboard as well as drag. The list shows on My Credits, and the ride page shows "#3 in your top 10." It is stored locally (an additive field) and included in backups.
- **Acceptance:** only ridden coasters are eligible. Un-logging a ranked coaster removes it from the list with notice. Reordering works at 390px and by keyboard.

#### C5. Shareable credit images

- **Why:** without accounts, an image is how a rider shows off their count. Each share introduces the community to Loop Troupe.
- **Requirements:** the rider makes a pixel-art image in the browser for their credit count, a milestone, their top 10, or a completed park (with the park's map when one exists). They share it through the phone's share sheet or download it. Nothing is uploaded. The image carries the Loop Troupe name and site address, and only the details the rider chooses (a display name is optional and typed by the rider). Images include the OSM credit when a map appears in them.
- **Acceptance:** works on iOS Safari and Android Chrome. The image is legible as a square post and a story. No network request is made to create it.

#### C6. Trip logs

- **Why:** riders think in trips ("Cedar Point, June 2026: 14 credits, 31 rides"), but today a log keeps only the first-ride date and a count.
- **Requirements:** record a park visit with a date, the coasters ridden that day (including re-rides), and an optional note, then see a trip history.
- **Why last:** it needs more than one dated ride per coaster, which is a ride-log schema change. That is a big change: `engineering_manager` proposes it and the owner approves it (Q-039).

**Success measures (no analytics; the owner deferred measurement):** the owner's team back-logs their full histories and uses the maps on their next park visit. The team recognizes every pilot map. The 3–5 trusted riders recruited for the guide (or riders like them) say the maps and ride pages make them want to log more. No credit is ever lost (`qa_engineer`).

**Non-goals for this track:** sign-in, accounts, cloud sync, and public profiles (deferred by the owner); leaderboards against other riders, feeds, or friends; analytics; any live 3D beyond the one-ride trial, and the trial itself until the owner approves it; stats from copyrighted databases, or guessed or estimated stats shown as fact; maps derived from downloaded videos; live wait times; importing from other apps (later).

### In parallel: the Cedar Point guide, free for now (approved; formerly Phase 1)

- **Goal:** build an excellent, trustworthy Cedar Point guide inside Loop Troupe: one an enthusiast would rather use than any free blog or video, that works on a phone in the park, and that ties into their credit log. Free to read for now.
- **Status (2026-10-02):** built as an unpublished draft (reachable only by a preview link, Q-032) and **waiting on the owner's team to verify it**. It runs in parallel with the credits app track and is not dropped. Agents keep researching and fixing; only the team marks claims verified.
- **Why it matters:** the guide's quality is the prerequisite for everything on the guide side, including any later paid test. Content work does not wait on accounts or payments.
- **Shared work with the credits app:** Cedar Point is the first pilot park for real maps (C1b), and the guide's coasters link to their new ride pages (C1a). Neither blocks the guide; the guide keeps its operating-coaster diorama until Cedar Point's real map passes its bar.
- **Park:** Cedar Point (approved).
- **Format:** mobile web pages inside the site (approved). Guide content lives in the public repository for now (owner accepts this; protection revisited later, Q-020). The technical format is `engineering_manager`'s call in `docs/tech_spec.md`; product requirements for it are in the brief.
- **Requirements:** `docs/guides/cedar-point-brief.md`, the brief the content writer and designer build from: sections, credits-app links, voice, mobile constraints, verification workflow, and acceptance criteria.
- **Primary source:** the owner's team's first-hand notes, `docs/guides/cedar-point-team-notes.md` (the team's record; agents do not edit it). The must-rides list and the ride-order plans are built from them; public research fills gaps.
- **Verification:** first-hand by the owner's team (approved). Every claim carries a status (draft, verified, needs check) and a "last verified" date; the team signs off before go-live, and the guide never presents an unverified claim as fact.
- **Timing (proposed; Q-030):** live by 1 March 2027, ahead of the 2027 trip-planning window, then re-verified on the team's first 2027 visit and after any 2027 announcements. Earlier is fine once it meets the acceptance criteria. Cedar Point's 2026 season ends in early November (assumption; verify), so any team visit before then is the last chance to check things in person this year.
- **Non-goals now:** paywall, checkout, pricing, analytics or visit counts, accounts, other parks, community tips or a forum, guide layers on the park map (gates, food, routes), a PDF edition, native apps, content protection.

**Definition of done** (the guide ships when all are true):

1. All guide sections in the brief are complete.
2. Zero claims in draft status. Every claim on the live page is verified, or visibly marked as unconfirmed.
3. A member of the owner's team has signed off each section (name or agreed credit, and date), and the owner has approved go-live.
4. Reviewed by `product_manager` (scope and acceptance) and `ux_content_designer` (voice and terminology); `product_designer` has reviewed the guide's UI; `qa_engineer` has passed the credits-app integration (no change or loss to existing ride logs); `product_experience_reviewer` has walked the journeys in the brief at 390px with no unresolved blocking findings.
5. Published on the live site and reachable from the Cedar Point park page.

**Definition of good** (the quality bar, judged without analytics):

- **Field test:** a team member uses the guide on a phone for a real day at Cedar Point and reports whether it answered their questions in the moment. Target: no factual errors found; any error found is fixed within 7 days.
- **Better than the free alternatives:** the team compares it with two leading free Cedar Point guides and agrees it is more useful for planning and riding, especially for a credit run.
- **Trusted readers:** 3–5 people outside the team who are planning a Cedar Point trip read it and give feedback directly (by message or conversation, not tracking). Target: most would recommend it to a friend, and none find it confusing to use one-handed in a queue. We may also ask, informally, whether they would have paid for it; this informs the deferred paid test without building checkout.
- **Sustainable:** we record the hours it took to produce, and the hours a full re-verification takes, so future guides can be planned.

- **Exit:** the owner reviews the live guide and chooses what comes next for guides: a second guide, guide layers on the map, or reopening the paid test below.

#### Later step (deferred): paid demand test

Deferred by the owner on 2026-10-02 ("I'm not worried about monetization and checkout logic just yet."). This was the guide track's original design (formerly Phase 1). It is kept here unchanged in substance for when monetization returns, and needs owner approval of Q-007 (price), Q-010 (checkout and counts), Q-020 (where paid content lives), and Q-027 (merchant of record) first. The guide contents list it used is superseded by the brief.

- **Goal:** learn whether riders will pay for a Loop Troupe park guide before building paid infrastructure.
- **Timing:** run in a trip-planning window, roughly March to early June. A waitlist can open sooner.
- **How it's offered:** a free Cedar Point page in Loop Troupe (at-a-glance, a must-ride teaser, video picks) with a clear offer for the full guide. The full guide is mobile-first and readable in a queue with weak signal. Purchase uses the simplest checkout the owner approves; no Loop Troupe accounts are needed (approach from `engineering_manager`; Q-010). Promote in enthusiast communities within each one's self-promotion rules.
- **Measures:** unique offer-page visitors, purchases, refunds, a short post-purchase survey (do you count credits? where did you hear about us?), a post-trip rating, and hours to produce and to refresh the guide. Aggregate counts only; no ride data leaves the browser (Q-010).
- **Success criteria (proposed), first 8 weeks after launch:**
  - **Pass:** at least 40 purchases **and** at least 3% of unique offer-page visitors buy; refunds under 10%; average post-trip rating at least 4 of 5.
  - **Fail:** fewer than 15 purchases **or** conversion under 1%.
  - **Between:** inconclusive; change one variable (price, positioning, or park) and rerun once.
- **Non-goals:** accounts, subscriptions, multiple parks, tips, new maps, native apps.
- **Acceptance:** the guide meets its definition of done; purchase-to-access works end to end; measures recorded.
- **If it fails:** guides stay free content that draws riders to the credits app, and paid scope goes back to the owner.

### After the pixel zoom-in ships: the 3D trial (approved 2026-10-02)

- **Owner interest:** "a virtual model of the park" and "a 3d model" of each ride, with stats.
- **Owner chose:** "Pixel now, 3D trial later." The option said: "Ride pages get a pixel-art zoom-in that matches the maps now. After that ships, the art director tries a chunky voxel/low-poly 3D version of one ride in our retro palette; it only goes live if you like it. Any 3D ride is an artist's interpretation (no open data has real track heights or loops)."
- **Approved:** once the pixel zoom-in on ride pages (C1a, requirement 4) has shipped, `art_director` makes a time-boxed trial of one ride in chunky voxel or low-poly 3D, in the site's retro palette. It goes live only if the owner likes the result. Any 3D ride is presented as an artist's interpretation, never as the real track: open data has track in plan view only, with no real heights, loops, or inversions.
- **Proposed (product team):** the trial ride is a Cedar Point coaster, since Cedar Point's map is first and the owner's team knows the park; `art_director` picks which, with `product_manager`. Render at low resolution and scale up with crisp pixels so it still reads as retro. A 3D library adds page weight and is a new dependency that needs `engineering_manager`'s approval; like everything in this track it ships with the site and makes no third-party request. Keep logging one tap away; the 3D view never sits between the rider and the ridden toggle.
- **Not scoped:** 3D for every ride or for whole parks (only if the owner approves the trial and asks for more); realistic 3D (departs from the approved look).
- **Non-goals:** presenting an interpreted model as the real track.

### Later: accounts and community credits (approved direction; deferred by the owner; formerly Phase 2)

- **Status:** the owner chose "Decide later" on 2026-10-02. Not scheduled, and no backend is chosen (Q-001). Everything in the credits app track works without it, and the backup format keeps every new field, so riders can carry their data into accounts later.
- **Goal:** the approved "log in and log your rides" experience, so credits follow the rider and riders can see each other.
- **Scope:** sign-in; cloud-saved credits with safe import of existing browser logs and backups; public profiles and public reviews behind a clear privacy choice (Q-015); guide purchases tied to the account if the deferred paid test runs and passes.
- **Non-goals:** friends, feeds, messaging, tips.
- **Acceptance:** a rider with an existing local log signs in and finds every credit, rating, review, top-10 list, and milestone intact; can export everything; can delete their account and data; logging a credit is no slower than today. The owner approves the approach first (Q-001).

### Later: community tips and more guides (proposed; formerly Phase 3)

- **Goal:** keep guides fresh and give the free side a reason to contribute.
- **Scope:** structured tips instead of a general forum (Q-011): short, dated, voted tips attached to a park, ride, gate, or food spot; old tips fade; contributors are credited when a tip shapes a guide. Add 2–4 guide parks once the Cedar Point guide meets its quality bar and the owner chooses to expand (Q-008). Posting tips likely needs accounts, so this follows them.
- **Non-goals:** threaded discussion, direct messages, user-uploaded video.
- **Acceptance:** a tip can be posted from a phone in under 30 seconds; moderation tools exist before launch (Q-011); guide changelogs show tip-driven updates.

### Later: guide layers on park maps (proposed; what remains of the former Phase 4)

- **Goal:** on a guide park's map, show the guide's gates, food picks, and ride-order routes, and link each to its guide section.
- **Depends on:** that park's real map (C1b) and a live guide.
- **Non-goals:** copies of official park maps; maps built from downloaded video.
- **Acceptance:** every pin matches a verified guide claim; the layer is off by default for non-guide readers and never slows logging.

## Guide content policy (proposed; first-hand team verification approved 2026-10-02)

1. **Original synthesis.** Guides are our own writing, structure, and analysis. Research may use blogs, videos, forums, official park sites, and public wait-time data, but we never copy or closely paraphrase another source's text, images, or maps.
2. **Sourcing and verification.** The owner's team's first-hand notes are each guide's primary source (for Cedar Point, `docs/guides/cedar-point-team-notes.md`); public research fills gaps. Each guide keeps a source log: URL or team note, date checked, and the claim it supports. Official sources win for hours, prices, and policies. AI-assisted research is fine; nothing is invented. Every claim carries a status (draft, verified, needs check) and a "last verified" date, only the owner's team marks a claim verified, and no unverified claim is ever presented as fact (workflow in `docs/guides/cedar-point-brief.md`).
3. **Creators' work.** Videos appear only through the platform's official embed, with the creator's name and a link. We never download, re-host, clip, or re-upload videos, and never put someone else's work behind a paywall: if one returns, video picks stay on free pages and the paywall covers only our own writing. Embeds load only when the reader taps them. The same rules cover video picks on ride pages.
4. **Freshness.** Every section shows a "last verified" date. Each guide is fully re-verified before its park's season opens and after major announcements (new rides, policy or gate changes). Reported errors are fixed within 7 days. Volatile details (prices, hours) link to the official source instead of being restated.
5. **Independence.** Not affiliated with any park. Park names are used only to identify parks; no park logos or official art; any sponsorship is disclosed.

## Shipped capabilities (MVP)

Live today. Nothing from the approved direction above has shipped yet. The Cedar Point guide exists in the code as an unpublished draft, reachable only by a preview link (Q-032).

- **Database:** every roller coaster in every US park, including defunct parks and coasters for legacy credits (curated; see `coaster_data_curator`).
- **Browse:** parks (search, state filter, sort, defunct toggle), park detail, and an A–Z index of every coaster.
- **Log a credit:** one-tap "ridden" toggle, or a full log with first-ride date, times ridden, a 1–5 star rating, and a written review. Edit or remove later.
- **Progress:** total credits, parks visited, states, average rating, per-park completion, a state "passport," and an isometric park diorama that colors in as coasters are ridden.
- **My Credits:** the full numbered history, with JSON backup export and import.
- **Local-first:** ride data stays in the rider's browser. No accounts, payments, guides, or community features yet.
- **Hosting:** GitHub Pages at https://glockstock.github.io/LoopTroupe/.
- **Mobile friendly** at phone widths.

## Experience direction

Retro late-1990s theme-park-tycoon feel: pixel fonts, beveled windows, grass and sky, isometric pixel-art coasters and parks, whimsical colors. Inspired by the genre without copying any game's assets or trademarks. Whimsy should never slow down logging a ride. Guides share the look but put readability first. Real park maps and ride pages use the same pixel-isometric language as today's dioramas: whole pixels, the site palette, small stepped animations. A stylized 3D trial of one ride (chunky voxel or low-poly in the retro palette) follows the pixel zoom-in and goes live only if the owner likes it (approved 2026-10-02); a realistic 3D view would depart from this direction and needs owner approval of representative screens.

## Non-goals (current)

- Parks outside the United States (Q-003).
- Live wait times, ride alerts, or real-time day planners; official apps and Ride Ready already do this.
- For now (owner, 2026-10-02): guide paywall, checkout, pricing, and analytics or visit counts; a PDF guide edition; protecting guide content from the public repository.
- For now (owner, 2026-10-02, "Decide later"): sign-in, accounts, cloud sync, and any backend.
- Leaderboards or comparisons against other riders (needs accounts).
- A general-purpose discussion forum (proposed; Q-011).
- Friends, feeds, and messaging.
- Native app-store apps (Q-016).
- Downloading, re-hosting, or paywalling other creators' videos or writing, including downloading YouTube videos to derive map or ride data.
- Ride stats copied from copyrighted databases (such as RCDB), or estimated stats presented as fact.
- Realistic 3D, and live 3D beyond the approved one-ride trial, unless the owner chooses it.
- Ads or selling rider data (proposed; Q-014).

Changes on 2026-10-02: ride stats (from open sources only) and real park layouts are now in scope in the credits app track (C1). Accounts remain approved direction but are deferred, so they are a non-goal for now (Q-001). Later the same day the owner approved a one-ride stylized 3D trial after the pixel zoom-in, so only realistic 3D and 3D beyond that trial remain non-goals; and ride stats now come from Wikidata and Wikipedia (CC BY-SA), still never from RCDB.

None of these are permanent rejections; changing them needs owner approval. See `docs/open_questions.md`.
