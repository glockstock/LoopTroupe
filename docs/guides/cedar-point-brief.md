# Cedar Point Guide: Brief

Owner: `product_manager`. Status as of 2026-10-02. This brief carries the product requirements for Phase 1 in `docs/spec.md`, and the content writer and designer build from it. The technical format (files, routes, checks) belongs to `engineering_manager` in `docs/tech_spec.md`; the requirements below are inputs to that work, not a technical design.

## What we're making

A free, mobile web guide to Cedar Point inside Loop Troupe. It should be the most useful thing an enthusiast can open on the way to the park and in the queue: opinionated, honest, checked by people who ride there, and linked to the rider's own credit log. It covers coasters first. It does not cover live waits (official apps do that) and has no paywall for now.

## Sources: the team's notes come first

1. **Primary source:** `docs/guides/cedar-point-team-notes.md`, the owner's team's first-hand notes. This is the team's record, so agents never edit it; the team adds dated entries. When a team note and public research disagree, the team note wins, and the conflict goes on the verification checklist so the team can look again.
2. **Public research fills gaps:** official Cedar Point pages first for hours, prices, policies, and height requirements, then blogs, forums, videos, and public wait-time history (see the Guide content policy in the spec). Every claim taken from research starts as **draft** and stays that way until the team verifies it.
3. **What the team has given us so far (2026-10-02 notes):**
   - Entered through the **main gate**.
   - **Must-rides:** Steel Vengeance, Top Thrill 2, Siren's Curse, Millennium Force, Maverick.
   - **Also enjoyed:** GateKeeper, Valravn.
   - **Opening move:** at rope drop, go straight to Steel Vengeance at the back of the park; it had the lowest guest volume early.
   - **Fallback:** if Steel Vengeance is down, backtrack a little to Millennium Force.
   - **Line-skip:** buy Cedar Point's paid line-skip pass (Fast Lane; the owner said "fast pass") for the top rides, especially Top Thrill 2, Steel Vengeance, and Siren's Curse. Use the park's current product name, and link to the official page for price.
   - **Needs check:** "There's probably a better gate" for reaching Steel Vengeance. This is the team's guess and they didn't try it. It starts as **needs check**, and the guide must not recommend another gate until the team confirms one.

First-hand notes describe what the team saw on their visits, so the guide frames them that way ("We went straight to Steel Vengeance; at rope drop it had the shortest line we saw all day") rather than as guarantees for every day.

## Sections

Each section opens with a one-line answer of 25 words or fewer, followed by the detail. The status column shows where content stands today: **Team** means built on the team's notes, and **Draft** means it needs research and then team verification.

| # | Section | Must answer | Status |
| --- | --- | --- | --- |
| 1 | **At a glance** | Is this guide for me? One day or two? The three things that matter most (from the team's notes: rope-drop Steel Vengeance, Fast Lane for the top rides, the five must-rides). It also shows **your Cedar Point credits** (below). | Team + draft |
| 2 | **When to go** | Best months and weekdays; crowd patterns (our read of public wait-time history plus team experience); seasonal events such as Halloween weekends; weather and wind (lakefront closures); early-entry rules, linked to the official page. | Draft (ask the team when they went) |
| 3 | **Getting there and getting in** | Parking; which gate to use for which plan (main gate is verified; any "better gate" is needs check); security, bags, and lockers; early entry; **is Fast Lane worth it?** (team: yes for the top rides), with the official link for price. | Team + draft |
| 4 | **Must-rides and your credit checklist** | The team's five must-rides, in their order, with a one-line "why"; "also great": GateKeeper and Valravn; every other operating coaster in honest tiers (the team rates them before go-live); height and rider-fit notes (test seats, larger riders, said neutrally and with official links); single-rider lines where they exist. Includes the **credit checklist** (below). | Team (top 7) + draft (rest) |
| 5 | **Ride-order plans** | Start with **"The troupe's plan,"** built from the notes: main gate, then straight to Steel Vengeance at rope drop, then Millennium Force if Steel Vengeance is down, then Fast Lane for Top Thrill 2, Steel Vengeance, and Siren's Curse, then the rest of the must-rides. Then "every credit in one day," "no Fast Lane," and "mixed heights or family" plans. Steps show **new credit** badges; times are labeled estimates. | Team (plan A) + draft |
| 6 | **Ride-by-ride notes** | For every operating coaster: a one-line verdict, best rows or seats, typical wait pattern, how often it goes down, whether it's worth riding at night, loose-article and locker rules, rider fit, and a log button. | Team (verdicts for the top 7) + draft |
| 7 | **Food and breaks** | Best bets, value picks, whether a dining plan is worth it (official link for price), when to eat to dodge the rush, where to sit, refill water, and charge a phone. | Draft (needs team input) |
| 8 | **Video picks** | One good on-ride POV per must-ride and one or two park overviews, with the creator named and linked, through official embeds that load only when tapped. The team approves the picks. | Draft |
| 9 | **Freshness and about this guide** | "Last verified" per section, the changelog, who checked it and how, independence ("not affiliated with Cedar Point"), and how to report a fix (contact to be decided: Q-028). | Draft |

Optional, not needed for go-live: a short "not coasters, still worth it" list of three to five items.

**Navigation:** a jump menu to every section, reachable with one thumb from anywhere in the guide. Each section has a shareable link.

## How the guide connects to the credits app

1. **Two-way links.** The Cedar Point park page links to the guide once it's published, and the guide links back to the park page.
2. **Your Cedar Point credits.** At a glance shows "You've ridden X of Y operating coasters here" and lists the ones still to ride. With an empty log, it invites the rider to tick off what they've ridden and doesn't scold.
3. **Mark rides from the guide.** The credit checklist (section 4) and every ride note (section 6) show whether the rider has ridden that coaster, with a one-tap "ridden" toggle and an option to open the full log modal. The guide uses the existing ride log and storage: no new schema, and nothing about an existing ride log changes except the rides the rider marks. Changes show up right away in Progress and My Credits.
4. **New-credit badges.** Ride-order plan steps and ride notes flag coasters that aren't in the rider's log yet.
5. **Operating vs. retired.** "Still to ride" counts only coasters operating now. The Cedar Point list in `js/data.js` mixes in retired coasters with no flag to tell them apart: Disaster Transport, Mean Streak, Top Thrill Dragster, and Wicked Twister, for example, look retired. `coaster_data_curator` confirms the operating list, and `engineering_manager` decides how the guide knows it (Q-029). Retired coasters appear only in a short "legacy credits" note.
6. **Rebuilt rides.** The guide follows the database: Top Thrill 2 and Steel Vengeance are separate entries from Top Thrill Dragster and Mean Streak, so they count as separate credits in Loop Troupe. The guide can mention the history but makes no ruling on credit conventions (Q-002).
7. **Privacy.** The guide reads the log only in the rider's browser. Nothing is sent anywhere, and there are no analytics.
8. **Works without a log.** Everything in the guide makes sense for a reader who never logs a credit.

## Voice and tone

- **An enthusiast talking to a friend.** We are the troupe ("we"), and the reader is "you." Be opinionated: say what to skip as clearly as what to ride. When the team is split, say so ("The troupe is split on Valravn").
- **Honest.** Mark first-hand experience as first-hand ("when we went"), opinions as our take, and estimates as estimates. No hype, no "secret hacks," no clickbait.
- **Whimsical but scannable.** A light retro theme-park-sim flavor belongs in headings, labels, and small asides, never in the actual instructions. Evoke the genre without borrowing any game's names or catchphrases.
- **Plain words.** Define enthusiast terms the first time they appear: credit, rope drop, airtime, Fast Lane, ERT. Use coaster names as the park writes them.
- **Respectful.** Rider-fit notes are neutral and practical. Never mock ride operators, other guests, or other creators.
- `ux_content_designer` owns final wording and terminology.

## Length and depth

- At a glance: 150 words or fewer, readable in under a minute.
- Every section opens with an answer line of 25 words or fewer.
- Ride notes: 50 to 120 words per coaster.
- Ride-order plans: 15 steps or fewer each.
- Whole guide: about 4,000 to 7,000 words. Depth goes where enthusiasts need it (plans, ride notes); everything else stays short.
- Volatile details (prices, hours, exact dates) link to the official source and aren't restated.

## Mobile constraints

- **Designed for 390px first.** No horizontal scroll, comfortable body type for long reading (pixel fonts only for headings and labels), and contrast strong enough for bright sun.
- **One-handed.** Tap targets at least 44px. The jump menu and the ridden toggles are reachable with a thumb. No hover-only content.
- **Weak signal.** All of the guide's text arrives in one load. Images are small and optional. Videos are tap-to-load placeholders, which also keeps third-party embeds from loading until the reader asks. Nothing waits on a slow request.
- **Offline (strongly wanted, Q-021).** A guide opened once at home should still read in the park with no signal. If full offline support is too much for Phase 1, the minimum is that a guide already open in a tab keeps working with the connection gone. `engineering_manager` decides the approach.
- **Light on battery.** No heavy animation, and nothing animates while the reader scrolls.

## Verification workflow

**A claim** is any statement a reader could act on or rely on: a fact (gate, rule, height, location), our take (rankings, best rows, "worth it"), or an estimate (waits, plan timings). Each one is recorded with:

| Field | Meaning |
| --- | --- |
| id | stable identifier |
| section | where it appears |
| kind | fact, our take, or estimate |
| status | `draft`, `verified`, or `needs check` |
| last verified | the date of the visit or check that confirmed it, not the date it was typed |
| verified by | the team member, credited as agreed (Q-028) |
| basis | team note (date), in-person visit (date), or official source (URL) |
| sources | research links that informed it |
| volatility | stable, seasonal, or volatile |

**Statuses**

- **Draft:** researched or written by an agent and not yet confirmed. **Never shown on the live site.**
- **Verified:** a member of the owner's team confirmed it, either first-hand or by checking the official source themselves, on the recorded date. Only the team sets this status; agents never do. Claims taken from the team notes count as verified on the date of the note (or of the visit, once we know it), except where the note says it's a guess.
- **Needs check:** a team guess, or a verified claim that has gone stale or been questioned. It may appear on the live site **only with a visible "unconfirmed" label** ("We haven't tried this yet: check before you go"), styled so it can't be mistaken for fact; otherwise it's held back. The "better gate" idea starts here. A stricter technical rule, such as holding back every unverified claim, is acceptable too.

**Changes in status**

- Draft → verified when the team confirms the claim, with a date and basis.
- Verified → needs check automatically when a new season starts and the claim hasn't been re-confirmed for it; when an announcement affects it (a new ride, a closure, a gate or policy change); when a reader reports a problem; or when a team visit contradicts it.
- Needs check → verified when re-confirmed, or the claim is removed.

**Display**

- Each section shows "Last verified <date>," using the oldest verified date among that section's claims.
- A section whose one-line answer is needs check shows a short notice at the top.
- The changelog records every material change with a date.

**Steps**

1. **Draft:** the content writer builds the guide around the team notes, fills gaps with research (every research claim is draft), and records sources.
2. **Checklist:** the writer produces a phone-friendly checklist of every draft and needs-check claim, grouped by park area and split into "can check from home" (official pages, video picks) and "needs a visit."
3. **Team pass:** team members mark claims verified, corrected, or cut, and section by section rate the coasters the notes don't cover yet.
4. **Editorial review:** `ux_content_designer` reviews voice and terminology, and `product_manager` checks scope and acceptance. Any wording change that alters a claim's meaning sends that claim back to the team.
5. **Sign-off:** a team member signs off each section with a name and date, and the owner approves go-live.
6. **Upkeep:** a full re-verification before each season opens and after major announcements; reported errors fixed within 7 days; a field check on the team's first visit each season.

**The hard rule:** the guide never goes live with draft claims, and nothing unverified is ever presented as fact.

## Acceptance criteria

1. All nine sections are complete, and each opens with an answer line.
2. The must-rides list and "The troupe's plan" match the team notes. Nothing in the notes is contradicted without a team-approved change.
3. Zero draft claims are visible. Needs-check claims appear only with the unconfirmed label (the "better gate" idea included). Every section shows a "last verified" date.
4. Every section is signed off by a team member, and the owner has approved go-live.
5. "Your Cedar Point credits" shows the right count and list for an empty log, a partial log, and a complete log, and counts only operating coasters.
6. Marking a ride from the guide updates the same log used everywhere else. Existing entries (dates, counts, ratings, reviews) are never changed or lost; `qa_engineer` passes this with evidence.
7. Plan steps and ride notes show correct new-credit badges for the rider's log.
8. The park page links to the guide and the guide links back; each section has a working shareable link.
9. At 390px: no horizontal scroll, tap targets at least 44px, the jump menu works one-handed, the guide is fully usable by keyboard and screen reader, and long text is set in the readable body font.
10. On a throttled slow connection, the guide's text is readable before any image or video loads, and no video loads until tapped. Offline behavior meets at least the minimum above.
11. Video picks credit and link each creator, use official embeds only, and nothing is downloaded or re-hosted.
12. Nothing is copied or closely paraphrased from another source, the source log is complete, and the independence note is present.
13. Reviews done: `ux_content_designer`, `product_manager`, `product_designer` (UI), `qa_engineer` (integration), and `product_experience_reviewer` (the journeys below, at 390px, with no unresolved blocking findings).

**Journeys to review:** (a) planning a trip at home on a phone; (b) at the gate at rope drop: "where do I go first?"; (c) Steel Vengeance is down: "what now?"; (d) in a queue, marking a credit one-handed; (e) a reader with no log who just wants the plan.

## What we still need from the owner's team

Listed most important first; the full list of open items lives in the checklist above.

1. **When you went:** dates (or month and weekday) of both visits, how busy it was, and whether you had early entry.
2. **Ratings for the rest of the lineup:** which other coasters you rode (Magnum XL-200, Raptor, Gemini, Blue Streak, Rougarou, Cedar Creek Mine Ride, the family and kiddie coasters, and so on) and a quick verdict on each: must, worth it, if time, or skip.
3. **Waits and Fast Lane:** roughly how long the top rides took with and without Fast Lane, which Fast Lane tier you bought, and whether you'd buy it again.
4. **The day's order:** what you rode after Steel Vengeance, and anything that went down.
5. **Food:** what you ate, what you'd get again, and what to avoid.
6. **Seats and quirks:** favorite rows, lockers or metal detectors, loose-article rules that caught you out, and rider-fit surprises.
7. **Parking and arrival:** where you parked and when you got there before opening.
8. **Another visit:** whether anyone can check the "better gate" idea, and anything else, before the 2026 season ends (assumed early November) or early in the 2027 season.
9. **Credit and contact:** how team members want to be credited on the public site, and where readers should report a fix (Q-028).
