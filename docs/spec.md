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

Earlier repository tagline: "Loop Troupe: Goodreads for roller coasters."

## Vision

Loop Troupe is two things under one retro theme-park roof:

1. **A free credits app.** The Goodreads of roller coasters: riders sign in, log every coaster they ride, review it, and watch their riding life add up. This side builds the community.
2. **Paid park guides.** A curated set of parks with comprehensive, current guides: when to go, which gate to use, which rides are must-hits, where to eat, and more. We dig through scattered blogs and long videos so riders don't have to.

The halves reinforce each other. The credits log knows which coasters a rider still needs; a guide tells them how to get those credits on the next trip; community knowledge keeps the guides fresh.

## Audience

- **Credit counters (free side):** enthusiasts who track credits, plan trips around new coasters, and like seeing and sharing their progress. Core moments: logging a ride from a queue on a phone, back-logging a riding history at home, looking back.
- **Trip planners (paid side):** anyone planning a day at a coaster-heavy park who wants a smarter plan than the park map: enthusiasts on a credit run, regulars visiting a new park, thrill-seeking groups and families.
- *Assumption to test:* guide buyers overlap with credit counters but are not the same group. Hardcore enthusiasts may already know the parks; casual visitors may value a guide more but never log a credit. Phase 1 must learn who buys.

## Market context (checked 2026-10-02)

Facts are sourced; lines marked *Read* are our interpretation. apps.apple.com, deeparrival.com, and rideready.app were blocked by this environment's network policy, so some figures come from search-result summaries and need a direct check.

- **Credits logging is crowded and mostly free.** Captain Coaster (free ratings and rankings, 14,000+ users by its own count), LogRide (Pro tier about €10.49/yr for stats and backdating), Loopr, Coasterly, and Coaster-Count. ([Captain Coaster](https://blog.captaincoaster.com/about), [CoasterForce thread](https://coasterforce.com/forums/threads/best-websites-to-count-rank-coasters.45438/), [Loopr](https://apps.apple.com/us/app/loopr-roller-coaster-tracker/id6670705734), [Coasterly](https://apps.apple.com/bf/app/coasterly/id6748962807), [LogRide](https://apps.apple.com/us/app/logride-theme-park-tracker/id1413056392))
  *Read:* the free side must win on feel, delight, and its link to guides, not on feature count.
- **Paid planning exists for destination parks.** TouringPlans covers Walt Disney World (about $25/yr), Universal Orlando (about $12/yr), Disneyland (about $10/yr), and Disney Cruise Line. ([TouringPlans](https://touringplans.com/walt-disney-world/join))
- **Regional coaster parks are not empty.** Ride Ready covers 15 parks, including Cedar Point, Kings Island, Carowinds, Kings Dominion, several Six Flags parks, Canada's Wonderland, Busch Gardens, and Dollywood. It sells live waits, day plans, and alerts (reported $24.99 per 14-day Trip Pass, or monthly) and publishes free crowd calendars and strategy pages. Official park apps are free with maps and waits; wait-time history is free (queue-times.com, thrill-data.com); free blog guides are plentiful. ([Ride Ready](https://rideready.app/), [Cedar Point official app](https://apps.apple.com/us/app/offline-guide-cedar-point/id903730552), [queue-times](https://queue-times.com/parks/50/stats/2025), [Undercover Tourist](https://www.undercovertourist.com/blog/guide-cedar-point-ohio/))
  *Read:* "nobody serves regional parks" is not true. Our wedge is **enthusiast-grade, opinionated guides linked to your credit log** (which credits you still need, the order to get them, best seats, quirks), not live waits or generic tips. Whether people pay for a guide when free blogs exist is the central unknown, so Phase 1 is a demand test.
- **Forums exist.** CoasterForce, CoasterBuzz, park boards such as KI Central, Theme Park Review, r/rollercoasters. ([CoasterBuzz](https://coasterbuzz.com/Forums/Topic/cedar-point-early-entry-strategy/2), [KI Central](https://kicentral.com/forums/topic/18737-my-thoughts-on-cedar-point-vs-kings-island/))
- **Open map data exists.** OpenStreetMap has coaster tagging (`roller_coaster=track`, `=station`, `=support`). ([OSM wiki](https://wiki.openstreetmap.org/wiki/Tag:roller_coaster=track)) Coverage per park is unverified.

## Approved direction

What the owner has asked for. Specific approaches live under the proposed sections below.

- **Free credits app with accounts.** Riders log in and log rides; the credits side is free and community-building ("the Goodreads of roller coasters"). Credits, reviews, and progress stay at the core.
- **Paywalled, curated park guides.** A curated list of parks, each with a comprehensive guide: when to go, which gates to use, must-ride rides, best food, and similar practical advice. Research may draw on blogs and YouTube (see Guide content policy).
- **Owner interest, not yet scoped:** community input that improves guides ("some kind of community forum"); better, semi-automatically generated park maps; an interactive park model with small animations (a train going down a drop) that zooms into a ride view with stats (speed, G-force, etc.) and the best videos available online.
- **Exploration started:** the owner approved starting an OpenStreetMap-generated park map spike (`art_director`, `coaster_data_curator`) and an accounts/backend/payments options write-up (`engineering_manager`, `docs/proposals/accounts-and-payments.md`). Neither is a commitment to build.
- **Unchanged:** US parks to start; retro theme-park-sim look; mobile friendly; GitHub Pages hosting until the owner approves a change.

## Positioning (proposed)

"Log every coaster for free. Unlock the insider guide to your next park." `product_marketing_manager` owns external messaging.

## Business model (proposed)

- **Free:** credits logging, reviews, profiles, progress, community tips, and curated video picks.
- **Paid:** our original park guides. Model and price pending (Q-007). Reference points: TouringPlans about $10–25/yr per destination; Ride Ready $24.99 per 14-day pass. Recommended for Phase 1: a one-time purchase of one park guide at about $9, good for the season.
- **No ads and no sale of rider data** (recommended; Q-014).

## Roadmap (proposed; sequencing awaits owner confirmation, Q-006)

Each phase ends at a gate. Phases 1 and 2 can overlap: Phase 1 is content work, Phase 2 is engineering work. All numbers are proposals.

### Phase 1: Guide demand test (one flagship guide)

- **Goal:** learn whether riders will pay for a Loop Troupe park guide before building paid infrastructure.
- **Park:** Cedar Point (recommended: biggest enthusiast draw, one of the largest coaster lineups in the US, real logistics questions). Alternatives: Kings Island, Dollywood (Q-008).
- **Timing:** Cedar Point's 2026 season ends in early November (assumption; verify). Write and verify the guide in the off-season and run the test in the 2027 trip-planning window, roughly March to early June. A waitlist can open sooner.
- **Guide contents:**
  1. *At a glance:* who it's for, how many days, the three things that matter most.
  2. *When to go:* best months and weekdays, crowd patterns from our own analysis of public wait-time history, events, weather, early-entry rules.
  3. *Getting in:* parking, which gate to use for which plan, security, whether line-skip passes are worth it.
  4. *Must-rides and the credit plan:* ranked must-rides; every credit at the park, linked to the rider's Loop Troupe log; height and rider-fit notes; single-rider options.
  5. *Ride order plans:* rope-drop plans (front-first and back-first), "every credit in one day," "big hitters only," and a family plan.
  6. *Ride-by-ride notes:* best rows, typical waits by time of day, downtime-prone rides, night rides, loose-article rules.
  7. *Food:* best bets, value picks, dining plans, when to eat to dodge peaks.
  8. *Video picks:* the best POVs and reviews, embedded with creator credit, on the free page.
  9. *Freshness:* a "last verified" date per section and a changelog.
- **How it's offered:** a free Cedar Point page in Loop Troupe (at-a-glance, a must-ride teaser, video picks) with a clear offer for the full guide. The full guide is mobile-first and readable in a queue with weak signal. Purchase uses the simplest checkout the owner approves; no Loop Troupe accounts are needed (approach from `engineering_manager`; Q-010). Promote in enthusiast communities within each one's self-promotion rules.
- **Measures:** unique offer-page visitors, purchases, refunds, a short post-purchase survey (do you count credits? where did you hear about us?), a post-trip rating, and hours to produce and to refresh the guide. Aggregate counts only; no ride data leaves the browser (Q-010).
- **Success criteria (proposed), first 8 weeks after launch:**
  - **Pass:** at least 40 purchases **and** at least 3% of unique offer-page visitors buy; refunds under 10%; average post-trip rating at least 4 of 5.
  - **Fail:** fewer than 15 purchases **or** conversion under 1%.
  - **Between:** inconclusive; change one variable (price, positioning, or park) and rerun once.
- **Non-goals:** accounts, subscriptions, multiple parks, tips, new maps, native apps.
- **Acceptance:** all nine sections complete; every factual claim traced in the source log; reviewed by `product_manager` and `ux_content_designer`; reads well at 390px; purchase-to-access works end to end; measures recorded.
- **If it fails:** guides become free content that draws riders to the credits app, and paid scope goes back to the owner.

### Phase 2: Accounts and community credits

- **Goal:** the approved "log in and log your rides" experience, so credits follow the rider and riders can see each other.
- **Scope:** sign-in; cloud-saved credits with safe import of existing browser logs and backups; public profiles and public reviews behind a clear privacy choice (Q-015); guide purchases tied to the account if Phase 1 passes.
- **Non-goals:** friends, feeds, messaging, tips.
- **Acceptance:** a rider with an existing local log signs in and finds every credit, rating, and review intact; can export everything; can delete their account and data; logging a credit is no slower than today. Owner approves the approach first (Q-001).

### Phase 3: Community tips and more guides

- **Goal:** keep guides fresh and give the free side a reason to contribute.
- **Scope:** structured tips instead of a general forum (Q-011): short, dated, voted tips attached to a park, ride, gate, or food spot; old tips fade; contributors are credited when a tip shapes a guide. Add 2–4 guide parks if Phase 1 passed (Q-008).
- **Non-goals:** threaded discussion, direct messages, user-uploaded video.
- **Acceptance:** a tip can be posted from a phone in under 30 seconds; moderation tools exist before launch (Q-011); guide changelogs show tip-driven updates.

### Phase 4: Generated park maps for guide parks

- **Goal:** an interactive pixel-isometric map for each guide park showing rides, gates, and food from the guide.
- **Scope:** maps generated semi-automatically from open map data (OpenStreetMap proposed, pending the current spike), then hand-polished; tap a ride to open its page.
- **Non-goals:** maps built from downloaded YouTube footage; copies of official park maps.
- **Acceptance:** a regular visitor recognizes the layout; works on phones; correct open-data attribution; producing a new park's map takes predictable effort.

### Phase 5: Ride zoom-in

- **Goal:** the owner's "click into a ride" moment: zoom from the park map into a ride view with small animations, key stats, and the best videos.
- **Scope and style depend on Q-012** (pixel-isometric vignette, stylized 3D, or realistic 3D). Stats come only from sources we may use; G-force appears only where a source publishes it.
- **Non-goals:** estimated stats shown as fact; stats copied from copyrighted databases.

## Guide content policy (proposed)

1. **Original synthesis.** Guides are our own writing, structure, and analysis. Research may use blogs, videos, forums, official park sites, and public wait-time data, but we never copy or closely paraphrase another source's text, images, or maps.
2. **Sourcing.** Each guide keeps an internal source log: URL, date checked, and the claim it supports. Official sources win for hours, prices, and policies; other practical claims need two independent sources or first-hand verification. AI-assisted research is fine; every claim is checked against a source and nothing is invented.
3. **Creators' work.** Videos appear only through the platform's official embed, with the creator's name and a link. We never download, re-host, clip, or re-upload videos, and never put someone else's work behind our paywall: video picks live on free pages, and the paywall covers only our own writing.
4. **Freshness.** Every section shows a "last verified" date. Each guide is fully re-verified before its park's season opens and after major announcements (new rides, policy or gate changes). Reported errors are fixed within 7 days. Volatile details (prices, hours) link to the official source instead of being restated.
5. **Independence.** Not affiliated with any park. Park names are used only to identify parks; no park logos or official art; any sponsorship is disclosed.

## Shipped capabilities (MVP)

Live today. Nothing from the approved direction above has shipped yet.

- **Database:** every roller coaster in every US park, including defunct parks and coasters for legacy credits (curated; see `coaster_data_curator`).
- **Browse:** parks (search, state filter, sort, defunct toggle), park detail, and an A–Z index of every coaster.
- **Log a credit:** one-tap "ridden" toggle, or a full log with first-ride date, times ridden, a 1–5 star rating, and a written review. Edit or remove later.
- **Progress:** total credits, parks visited, states, average rating, per-park completion, a state "passport," and an isometric park diorama that colors in as coasters are ridden.
- **My Credits:** the full numbered history, with JSON backup export and import.
- **Local-first:** ride data stays in the rider's browser. No accounts, payments, guides, or community features yet.
- **Hosting:** GitHub Pages at https://glockstock.github.io/LoopTroupe/.
- **Mobile friendly** at phone widths.

## Experience direction

Retro late-1990s theme-park-tycoon feel: pixel fonts, beveled windows, grass and sky, isometric pixel-art coasters and parks, whimsical colors. Inspired by the genre without copying any game's assets or trademarks. Whimsy should never slow down logging a ride. Guides share the look but put readability first. A realistic 3D ride view would depart from this direction and needs owner approval (Q-012).

## Non-goals (current)

- Parks outside the United States (Q-003).
- Live wait times, ride alerts, or real-time day planners; official apps and Ride Ready already do this.
- A general-purpose discussion forum (proposed; Q-011).
- Friends, feeds, and messaging.
- Native app-store apps (Q-016).
- Downloading, re-hosting, or paywalling other creators' videos or writing.
- Ads or selling rider data (proposed; Q-014).

Accounts and cloud sync have moved from non-goals to approved direction (Phase 2; approach pending Q-001). Ride stats such as height, speed, and G-force are now owner interest for Phase 5, subject to Q-012.

None of these are permanent rejections; changing them needs owner approval. See `docs/open_questions.md`.
