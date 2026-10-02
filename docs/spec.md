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

## Vision

Loop Troupe is two things under one retro theme-park roof:

1. **A free credits app.** The Goodreads of roller coasters: riders sign in, log every coaster they ride, review it, and watch their riding life add up. This side builds the community.
2. **Park guides (paid eventually).** A curated set of parks with comprehensive, current guides: when to go, which gate to use, which rides are must-hits, where to eat, and more. We dig through scattered blogs and long videos so riders don't have to, and the people who ride these parks check every claim. The owner's long-term intent is a paywall; for now guides are free while we make the first one excellent.

The halves reinforce each other. The credits log knows which coasters a rider still needs; a guide tells them how to get those credits on the next trip; community knowledge keeps the guides fresh.

## Audience

- **Credit counters (free side):** enthusiasts who track credits, plan trips around new coasters, and like seeing and sharing their progress. Core moments: logging a ride from a queue on a phone, back-logging a riding history at home, looking back.
- **Trip planners (paid side):** anyone planning a day at a coaster-heavy park who wants a smarter plan than the park map: enthusiasts on a credit run, regulars visiting a new park, thrill-seeking groups and families.
- *Assumption to test (later):* guide buyers overlap with credit counters but are not the same group. Hardcore enthusiasts may already know the parks; casual visitors may value a guide more but never log a credit. With monetization deferred, Phase 1 no longer measures who buys; direct feedback from invited readers gives an early, qualitative read.

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
  *Read:* "nobody serves regional parks" is not true. Our wedge is **enthusiast-grade, opinionated guides linked to your credit log** (which credits you still need, the order to get them, best seats, quirks), not live waits or generic tips. Whether people pay for a guide when free blogs exist remains the central unknown for the paid side; the owner has deferred testing it, so Phase 1 first builds an excellent guide, free.
- **Forums exist.** CoasterForce, CoasterBuzz, park boards such as KI Central, Theme Park Review, r/rollercoasters. ([CoasterBuzz](https://coasterbuzz.com/Forums/Topic/cedar-point-early-entry-strategy/2), [KI Central](https://kicentral.com/forums/topic/18737-my-thoughts-on-cedar-point-vs-kings-island/))
- **Open map data exists.** OpenStreetMap has coaster tagging (`roller_coaster=track`, `=station`, `=support`). ([OSM wiki](https://wiki.openstreetmap.org/wiki/Tag:roller_coaster=track)) Coverage per park is unverified.

## Approved direction

What the owner has asked for. Specific approaches live under the proposed sections below.

- **Free credits app with accounts.** Riders log in and log rides; the credits side is free and community-building ("the Goodreads of roller coasters"). Credits, reviews, and progress stay at the core. Accounts are built after the first guide (below).
- **Paywalled, curated park guides.** A curated list of parks, each with a comprehensive guide: when to go, which gates to use, must-ride rides, best food, and similar practical advice. Research may draw on blogs and YouTube (see Guide content policy).
  - **Paywall deferred (2026-10-02).** The owner is "not worried about monetization and checkout logic just yet." The first guide ships free. No pricing, checkout, or analytics/measurement work until the owner reopens it (Q-007, Q-010, Q-020, Q-027).
- **Roadmap starts with Phase 1, before accounts (2026-10-02).** Build the Cedar Point guide first; accounts (Phase 2) are built after it. The order of Phases 3–5 is still a proposal (Q-006).
- **Cedar Point is the first guide (2026-10-02).** Next parks are open (Q-008).
- **Guides are mobile web pages inside the site (2026-10-02).** Not a PDF for now ("We might pivot to PDF later"). The owner accepts that guide content is public in the GitHub repository for now; protection is revisited later.
- **First-hand verification by the owner's team (2026-10-02).** The owner and their friends have visited Cedar Point and will fact-check the guide each season. The team signs off before a guide goes live (workflow in `docs/guides/cedar-point-brief.md`).
- **Owner interest, not yet scoped:** community input that improves guides ("some kind of community forum"); better, semi-automatically generated park maps; an interactive park model with small animations (a train going down a drop) that zooms into a ride view with stats (speed, G-force, etc.) and the best videos available online.
- **Exploration started:** the owner approved starting an OpenStreetMap-generated park map spike (`art_director`, `coaster_data_curator`) and an accounts/backend/payments options write-up (`engineering_manager`, `docs/proposals/accounts-and-payments.md`). Neither is a commitment to build.
- **Unchanged:** US parks to start; retro theme-park-sim look; mobile friendly; GitHub Pages hosting until the owner approves a change.

## Positioning (proposed)

"Log every coaster for free. Unlock the insider guide to your next park." `product_marketing_manager` owns external messaging. While guides are free (Phase 1), "unlock" does not apply; a free-guide variant such as "Log every coaster. Get the insider guide to your next park." is a suggestion for `product_marketing_manager` to confirm.

## Business model (proposed; deferred by the owner on 2026-10-02)

Kept for when the owner reopens monetization. Nothing here is being built now.

- **Free:** credits logging, reviews, profiles, progress, community tips, and curated video picks.
- **Paid:** our original park guides. Model and price pending (Q-007). Reference points: TouringPlans about $10–25/yr per destination; Ride Ready $24.99 per 14-day pass. Recommended for the deferred paid test: a one-time purchase of one park guide at about $9, good for the season.
- **No ads and no sale of rider data** (recommended; Q-014).

## Roadmap (Phase 1 first and before accounts: approved 2026-10-02; order of Phases 3–5 still proposed, Q-006)

Each phase ends at a gate. Phase 1 comes first and Phase 2 (accounts) is built after it, per the owner. Earlier exploration (the accounts options write-up and the map spike) can continue as reference, but it does not start Phase 2 implementation. Numbers below are proposals unless marked approved.

### Phase 1: The Cedar Point guide, free for now (approved)

- **Goal:** build an excellent, trustworthy Cedar Point guide inside Loop Troupe: one an enthusiast would rather use than any free blog or video, that works on a phone in the park, and that ties into their credit log. Free to read for now.
- **Why first:** the guide's quality is the prerequisite for everything on the guide side, including any later paid test. Content work does not wait on accounts or payments.
- **Park:** Cedar Point (approved).
- **Format:** mobile web pages inside the site (approved). Guide content lives in the public repository for now (owner accepts this; protection revisited later, Q-020). The technical format is `engineering_manager`'s call in `docs/tech_spec.md`; product requirements for it are in the brief.
- **Requirements:** `docs/guides/cedar-point-brief.md`, the brief the content writer and designer build from: sections, credits-app links, voice, mobile constraints, verification workflow, and acceptance criteria.
- **Primary source:** the owner's team's first-hand notes, `docs/guides/cedar-point-team-notes.md` (the team's record; agents do not edit it). The must-rides list and the ride-order plans are built from them; public research fills gaps.
- **Verification:** first-hand by the owner's team (approved). Every claim carries a status (draft, verified, needs check) and a "last verified" date; the team signs off before go-live, and the guide never presents an unverified claim as fact.
- **Timing (proposed; Q-030):** live by 1 March 2027, ahead of the 2027 trip-planning window, then re-verified on the team's first 2027 visit and after any 2027 announcements. Earlier is fine once it meets the acceptance criteria. Cedar Point's 2026 season ends in early November (assumption; verify), so any team visit before then is the last chance to check things in person this year.
- **Non-goals now:** paywall, checkout, pricing, analytics or visit counts, accounts, other parks, community tips or a forum, generated maps, a PDF edition, native apps, content protection.

**Definition of done** (Phase 1 ships when all are true):

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

- **Exit:** the owner reviews the live guide and chooses what comes next: Phase 2 (accounts), a second guide, or reopening the paid test below.

#### Later step (deferred): paid demand test

Deferred by the owner on 2026-10-02 ("I'm not worried about monetization and checkout logic just yet."). This was Phase 1's original design. It is kept here unchanged in substance for when monetization returns, and needs owner approval of Q-007 (price), Q-010 (checkout and counts), Q-020 (where paid content lives), and Q-027 (merchant of record) first. The guide contents list it used is superseded by the brief.

- **Goal:** learn whether riders will pay for a Loop Troupe park guide before building paid infrastructure.
- **Timing:** run in a trip-planning window, roughly March to early June. A waitlist can open sooner.
- **How it's offered:** a free Cedar Point page in Loop Troupe (at-a-glance, a must-ride teaser, video picks) with a clear offer for the full guide. The full guide is mobile-first and readable in a queue with weak signal. Purchase uses the simplest checkout the owner approves; no Loop Troupe accounts are needed (approach from `engineering_manager`; Q-010). Promote in enthusiast communities within each one's self-promotion rules.
- **Measures:** unique offer-page visitors, purchases, refunds, a short post-purchase survey (do you count credits? where did you hear about us?), a post-trip rating, and hours to produce and to refresh the guide. Aggregate counts only; no ride data leaves the browser (Q-010).
- **Success criteria (proposed), first 8 weeks after launch:**
  - **Pass:** at least 40 purchases **and** at least 3% of unique offer-page visitors buy; refunds under 10%; average post-trip rating at least 4 of 5.
  - **Fail:** fewer than 15 purchases **or** conversion under 1%.
  - **Between:** inconclusive; change one variable (price, positioning, or park) and rerun once.
- **Non-goals:** accounts, subscriptions, multiple parks, tips, new maps, native apps.
- **Acceptance:** the guide meets Phase 1's definition of done; purchase-to-access works end to end; measures recorded.
- **If it fails:** guides stay free content that draws riders to the credits app, and paid scope goes back to the owner.

### Phase 2: Accounts and community credits

- **Goal:** the approved "log in and log your rides" experience, so credits follow the rider and riders can see each other.
- **Scope:** sign-in; cloud-saved credits with safe import of existing browser logs and backups; public profiles and public reviews behind a clear privacy choice (Q-015); guide purchases tied to the account if the deferred paid test runs and passes.
- **Non-goals:** friends, feeds, messaging, tips.
- **Acceptance:** a rider with an existing local log signs in and finds every credit, rating, and review intact; can export everything; can delete their account and data; logging a credit is no slower than today. Owner approves the approach first (Q-001).

### Phase 3: Community tips and more guides

- **Goal:** keep guides fresh and give the free side a reason to contribute.
- **Scope:** structured tips instead of a general forum (Q-011): short, dated, voted tips attached to a park, ride, gate, or food spot; old tips fade; contributors are credited when a tip shapes a guide. Add 2–4 guide parks once the Cedar Point guide meets its quality bar and the owner chooses to expand (Q-008).
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

## Guide content policy (proposed; first-hand team verification approved 2026-10-02)

1. **Original synthesis.** Guides are our own writing, structure, and analysis. Research may use blogs, videos, forums, official park sites, and public wait-time data, but we never copy or closely paraphrase another source's text, images, or maps.
2. **Sourcing and verification.** The owner's team's first-hand notes are each guide's primary source (for Cedar Point, `docs/guides/cedar-point-team-notes.md`); public research fills gaps. Each guide keeps a source log: URL or team note, date checked, and the claim it supports. Official sources win for hours, prices, and policies. AI-assisted research is fine; nothing is invented. Every claim carries a status (draft, verified, needs check) and a "last verified" date, only the owner's team marks a claim verified, and no unverified claim is ever presented as fact (workflow in `docs/guides/cedar-point-brief.md`).
3. **Creators' work.** Videos appear only through the platform's official embed, with the creator's name and a link. We never download, re-host, clip, or re-upload videos, and never put someone else's work behind a paywall: if one returns, video picks stay on free pages and the paywall covers only our own writing. Embeds load only when the reader taps them.
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
- For now (owner, 2026-10-02): guide paywall, checkout, pricing, and analytics or visit counts; a PDF guide edition; protecting guide content from the public repository.
- A general-purpose discussion forum (proposed; Q-011).
- Friends, feeds, and messaging.
- Native app-store apps (Q-016).
- Downloading, re-hosting, or paywalling other creators' videos or writing.
- Ads or selling rider data (proposed; Q-014).

Accounts and cloud sync have moved from non-goals to approved direction (Phase 2; approach pending Q-001). Ride stats such as height, speed, and G-force are now owner interest for Phase 5, subject to Q-012.

None of these are permanent rejections; changing them needs owner approval. See `docs/open_questions.md`.
