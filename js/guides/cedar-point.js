/* Loop Troupe — Cedar Point park guide (content file).
   Schema v1; the contract is in docs/tech_spec.md, "Park guides".
   Requirements and voice: docs/guides/cedar-point-brief.md.
   Run `node scripts/check-guides.mjs` after every edit.

   Writers: edit only the data below. Plain data only: strings, numbers,
   booleans, null, arrays, objects. No functions, no HTML.

   A "claim" is any object with `text`. Fields:
     id            stable slug, unique in this guide ('food-best-bet'); never reuse
     text          what we tell the rider. Inline markup allowed, nothing else:
                   **bold**  and  [link label](https://example.com)
     kind          'fact' | 'take' (our opinion) | 'estimate' (waits, timings)
     volatility    'stable' | 'seasonal' | 'volatile' (prices, hours: link, don't restate)
     status        'draft'        written, not confirmed by the team (never shown live)
                   'needs-check'  team guess, or verified but stale/questioned
                                  (shown live only with an "Unconfirmed" label)
                   'verified'     confirmed by the team; only the team sets this
     lastVerified  'YYYY-MM-DD' of the visit or check that confirmed it, or null
   Required once verified:
     verifiedBy    team member, credited as agreed (Q-028)
     basis         'team note 2026-10-02' | 'visit YYYY-MM-DD' | official URL
   Optional:
     sources       ['https://…'] research links (internal; never shown)
   `kind` and `volatility` may be left out while a claim is draft.

   Sections: `status` / `lastVerified` / `verifiedBy` are the section sign-off.
   The "Last verified" date readers see is computed from the claims.

   Coasters are referenced only by their stable IDs from js/data.js
   ('cedar-point--…'). Never invent or rename an ID.

   Status: first full draft (2026-10-02). Claims from the team notes are verified;
   everything from public research is draft until the team checks it.
   Checklist for the team: docs/guides/cedar-point-verification.md. */
window.GUIDES = window.GUIDES || {};
window.GUIDES['cedar-point'] = {
  schema: 1,
  parkId: 'cedar-point',
  title: 'Cedar Point',
  season: 2027,
  // Verified claims checked before this date count as needs-check (set it when
  // a new season opens, so last season's checks show as unconfirmed). null = off.
  staleBefore: null,

  // The coasters a rider can ride this season, in display order. Drives
  // "You've ridden X of Y operating coasters here". js/data.js also lists
  // retired coasters with no flag, so this list is the authority (Q-029).
  // It is itself a claim: coaster_data_curator and the team confirm it.
  // 2026 check (Q-031): WildCat closed in 2011 and is out; Wild Mouse (2023) is in.
  // Pipe Scream is a Zamperla Disk'O that the park lists as a thrill ride, not a coaster.
  credits: {
    id: 'credits-operating',
    operating: [
      'cedar-point--steel-vengeance',
      'cedar-point--millennium-force',
      'cedar-point--maverick',
      'cedar-point--top-thrill-2',
      'cedar-point--siren-s-curse',
      'cedar-point--gatekeeper',
      'cedar-point--valravn',
      'cedar-point--magnum-xl-200',
      'cedar-point--raptor',
      'cedar-point--rougarou',
      'cedar-point--gemini',
      'cedar-point--blue-streak',
      'cedar-point--cedar-creek-mine-ride',
      'cedar-point--corkscrew',
      'cedar-point--iron-dragon',
      'cedar-point--wild-mouse',
      'cedar-point--woodstock-express',
      'cedar-point--wilderness-run',
    ],
    text: 'These 18 coasters are running in the 2026 season, matching the park\'s own count of 18. The 2027 lineup isn\'t announced yet.',
    kind: 'fact',
    volatility: 'seasonal',
    status: 'draft',
    lastVerified: null,
    sources: ['https://www.sixflags.com/cedarpoint/attractions', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://rcdb.com/4529.htm', 'https://en.wikipedia.org/wiki/Cedar_Point', 'https://www.sixflags.com/cedarpoint/attractions/wild-mouse', 'https://www.sixflags.com/cedarpoint/attractions/pipe-scream', 'https://en.wikipedia.org/wiki/WildCat_(Cedar_Point)', 'https://www.sixflags.com/cedarpoint/fast-lane'],
  },

  sections: [
    {
      id: 'at-a-glance',
      title: 'At a glance',
      status: 'draft', lastVerified: null,
      answer: { id: 'glance-answer', text: 'Head straight to Steel Vengeance at opening, buy Fast Lane for the top rides, and ride our five must-rides.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
      blocks: [
        { type: 'p', id: 'glance-who', text: 'For coaster fans chasing the big rides and the credits (a **credit** is a coaster you\'ve ridden at least once).', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
        {
          type: 'facts',
          items: [
            { id: 'glance-gate', label: 'Gate we used', text: 'Main gate', kind: 'fact', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'glance-days', label: 'Days needed', text: 'One for the must-rides with Fast Lane; two for every credit without rushing.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'glance-credits', label: 'Operating coasters', text: '18 in 2026, by the park\'s count. 2027 isn\'t announced yet.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://rcdb.com/4529.htm'] },
          ],
        },
        {
          type: 'list',
          title: 'Three things that matter most',
          ordered: true,
          items: [
            { id: 'glance-top-1', text: '**Rope-drop Steel Vengeance.** At opening (rope drop), go straight to the back of the park, where we found the lowest crowds. If it\'s down, backtrack a bit to Millennium Force.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'glance-top-2', text: '**Use Fast Lane for the top rides,** especially Top Thrill 2, Steel Vengeance, and Siren\'s Curse. Fast Lane is Cedar Point\'s paid line-skip pass.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'glance-top-3', text: '**Ride the five must-rides:** Steel Vengeance, Top Thrill 2, Siren\'s Curse, Millennium Force, and Maverick.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
          ],
        },
        { type: 'credits', show: 'summary' },
      ],
    },

    {
      id: 'when-to-go',
      title: 'When to go',
      status: 'draft', lastVerified: null,
      answer: { id: 'when-answer', text: 'Midweek in late May, June, or September. Skip summer Saturdays and October Saturdays, and check the official calendar first.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.explore.com/1627130/best-time-visit-cedar-point-hoping-avoid-crowds-possible/', 'https://deeparrival.com/theme-parks/cedar-point/crowd-calendar/'] },
      blocks: [
        { type: 'p', id: 'when-season', text: 'Cedar Point is a seasonal park: open daily through the summer, then on fall weekends for HalloWeekends into early November. Dates and hours change every year, so start with the [official calendar](https://www.sixflags.com/cedarpoint/park-hours). The 2027 calendar isn\'t out yet.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/park-hours', 'https://www.sixflags.com/cedarpoint', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
        {
          type: 'list',
          title: 'Crowds, by our read',
          items: [
            { id: 'when-best', text: '**Best bets:** Tuesday to Thursday from mid-May through June, and weekdays in September.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.explore.com/1627130/best-time-visit-cedar-point-hoping-avoid-crowds-possible/', 'https://deeparrival.com/theme-parks/cedar-point/crowd-calendar/', 'https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
            { id: 'when-school', text: '**School trips:** May and early-June weekdays can bring school groups that crowd the morning, then thin out by mid-afternoon.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/crowd-calendar/'] },
            { id: 'when-peak', text: '**Busiest:** July and early August, summer Saturdays, holiday weekends, and HalloWeekends Saturdays in October.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.explore.com/1627130/best-time-visit-cedar-point-hoping-avoid-crowds-possible/', 'https://deeparrival.com/theme-parks/cedar-point/crowd-calendar/'] },
            { id: 'when-late', text: '**The last two hours** are often the quietest for the big rides, as families head home.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
          ],
        },
        {
          type: 'list',
          title: 'Events, weather, and closures',
          items: [
            { id: 'when-halloweekends', text: '**HalloWeekends** runs on select days from mid-September to early November (in 2026, September 17 to November 1), with haunted mazes at night at extra cost. Fast Lane doesn\'t cover the haunted attractions.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint', 'https://www.sixflags.com/cedarpoint/fast-lane', 'https://www.sixflags.com/blog/blog/cedar-point-2026-whats-new'] },
            { id: 'when-wind', text: '**Wind and rain close rides.** The park sits on a Lake Erie peninsula, the tallest coasters can pause in high wind, and there are no rain checks.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://en.wikipedia.org/wiki/Top_Thrill_2'] },
            { id: 'when-windy-day', text: '**On a windy day,** ride the big ones the moment they\'re running, and save meals and shows for when they stop.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'when-closures', text: '**Some rides keep short hours late in the season.** In fall 2026, Gemini and Rougarou were closed on Thursdays and opened at noon Friday to Sunday. Check [scheduled ride closures](https://www.sixflags.com/cedarpoint/scheduled-ride-closures) the week you go.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/scheduled-ride-closures'] },
          ],
        },
        { type: 'p', id: 'when-stay', text: '**Hotel or day trip?** Staying at one of the park\'s own resort hotels adds Early Entry, and from Hotel Breakers you can walk to the park. A hotel off the peninsula means driving in and paying for parking each day.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://www.sixflags.com/cedarpoint/early-entry'] },
        { type: 'p', tone: 'tip', id: 'when-early-entry', text: '**Early Entry** (ERT, short for extra ride time) lets Cedar Point resort hotel guests and Prestige season passholders in an hour before the public, on a short list of rides. In 2026 that list included Top Thrill 2 and Millennium Force but not Steel Vengeance. [Early Entry details](https://www.sixflags.com/cedarpoint/early-entry).', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/early-entry', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
      ],
    },

    {
      id: 'getting-in',
      title: 'Getting there and getting in',
      status: 'draft', lastVerified: null,
      answer: { id: 'in-answer', text: 'Use the main gate, as we did, and buy Fast Lane for the top rides.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
      blocks: [
        { type: 'p', id: 'in-drive', text: 'Cedar Point is on a peninsula in Sandusky, Ohio, on Lake Erie, roughly an hour\'s drive from both Cleveland and Toledo. Most people drive; the [directions page](https://www.sixflags.com/cedarpoint/directions) has the details.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/directions', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
        { type: 'p', id: 'in-parking', text: 'You drive across the causeway and pay at the tollbooths. General parking is the big lot in front of the main gate; preferred parking is closer and costs more. Keep your receipt: it lets you leave and come back the same day without paying twice. Prices are on the [official site](https://www.sixflags.com/cedarpoint).', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://thrillzing.com/theme-parks/cedar-point-visit-tips/', 'https://www.sixflags.com/cedarpoint/directions'] },
        { type: 'p', id: 'in-arrive', text: 'Aim to be parked 45 minutes before opening. Every gate has metal detectors and bag checks every day, and the line builds fast.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://thrillzing.com/theme-parks/cedar-point-visit-tips/'] },
        {
          type: 'picks',
          kind: 'gate',
          title: 'Which gate',
          items: [
            { id: 'gate-main', name: 'Main gate', bestFor: 'The troupe\'s plan', text: 'We used the main gate. Steel Vengeance is at the back of the park, so we went straight there. GateKeeper flies right over this entrance.', kind: 'fact', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'gate-alt', name: 'A closer gate for Steel Vengeance?', bestFor: 'Not tested yet', text: 'There\'s probably a better gate for getting to Steel Vengeance, but we haven\'t tried one. Until we do, use the main gate.', kind: 'take', volatility: 'stable', status: 'needs-check', lastVerified: null, basis: 'Team guess, team notes reported 2026-10-02 (not tried)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'gate-others', name: 'Other entrances', bestFor: 'Resort guests; the marina side', text: 'Cedar Point has other entrances, including one on the marina side near Valravn and one by Hotel Breakers. Which ones open to day guests, and when, can change: check the [park map](https://www.sixflags.com/cedarpoint/directions) or ask at the tollbooth.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://kicentral.com/forums/topic/18818-cedar-point-entrances/', 'https://coasterbuzz.com/Forums/Topic/which-cedar-point-entrance', 'https://coasterbuzz.com/Forums/Topic/cedar-point-early-entry-strategy'] },
          ],
        },
        { type: 'p', tone: 'warning', id: 'in-bags', text: '**Travel light.** Steel Vengeance, Top Thrill 2, Siren\'s Curse, Millennium Force, Valravn, GateKeeper, Rougarou, and Magnum XL-200 don\'t allow bags or loose items in line. Lockers by the rides take credit cards only; an all-day locker near the main gate lets you come and go. [Locker and loose-article rules](https://www.sixflags.com/cedarpoint/frequently-asked-questions).', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://www.sixflags.com/cedarpoint/attractions/steel-vengeance', 'https://www.sixflags.com/cedarpoint/attractions/top-thrill-2', 'https://www.sixflags.com/cedarpoint/attractions/sirens-curse'] },
        {
          type: 'list',
          title: 'Is Fast Lane worth it?',
          items: [
            { id: 'in-fastlane-yes', text: '**For the top rides, yes.** Use it especially for Top Thrill 2, Steel Vengeance, and Siren\'s Curse.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'in-fastlane-what', text: 'Fast Lane is a wristband for a separate, shorter line, as many times as you like on the day you bought it. It\'s per person, can\'t be shared, and the park sells a limited number each day.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'in-fastlane-plus', text: '**Get the Plus tier for the big ones.** In 2026, Steel Vengeance, Top Thrill 2, Siren\'s Curse, Millennium Force, Maverick, and Valravn were Fast Lane Plus rides; regular Fast Lane covered the rest, including GateKeeper, Magnum XL-200, and Raptor. This year\'s list and price: [official Fast Lane page](https://www.sixflags.com/cedarpoint/fast-lane).', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'in-fastlane-single', text: '**Single-Use Fast Lane** skips one line, once, on one ride. It\'s sold in the park app for select rides at select times: handy when only one line is out of hand.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane', 'https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
          ],
        },
        { type: 'p', id: 'in-rentals', text: 'Strollers, wheelchairs, and electric scooters (ECVs) can be rented at the main gate. Book wheelchairs and ECVs online at least a day ahead; they\'re first come, first served.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions', 'https://www.sixflags.com/cedarpoint/rentals'] },
        { type: 'p', id: 'in-reentry', text: 'Leaving for lunch or your hotel? Get a re-entry ticket from the staff at the exit (season passholders don\'t need one).', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
      ],
    },

    {
      id: 'must-rides',
      title: 'Must-rides and your credit checklist',
      status: 'draft', lastVerified: null,
      answer: { id: 'must-answer', text: 'Our five must-rides: Steel Vengeance, Top Thrill 2, Siren\'s Curse, Millennium Force, and Maverick. We also enjoyed GateKeeper and Valravn.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
      blocks: [
        {
          type: 'rides',
          title: 'The troupe\'s must-rides',
          items: [
            { id: 'must-steel-vengeance', coasterId: 'cedar-point--steel-vengeance', text: 'Must-ride, and our first ride of the day.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'must-top-thrill-2', coasterId: 'cedar-point--top-thrill-2', text: 'Must-ride. One of the top rides we\'d use Fast Lane for.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'must-sirens-curse', coasterId: 'cedar-point--siren-s-curse', text: 'Must-ride. One of the top rides we\'d use Fast Lane for.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'must-millennium-force', coasterId: 'cedar-point--millennium-force', text: 'Must-ride, and our backup first ride if Steel Vengeance is down.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'must-maverick', coasterId: 'cedar-point--maverick', text: 'Must-ride.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
          ],
        },
        {
          type: 'rides',
          title: 'Also great',
          items: [
            { id: 'also-gatekeeper', coasterId: 'cedar-point--gatekeeper', text: 'The troupe enjoyed this one too.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'also-valravn', coasterId: 'cedar-point--valravn', text: 'The troupe enjoyed this one too.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
          ],
        },
        {
          type: 'rides',
          title: 'Worth the wait',
          items: [
            { id: 'tier-magnum', coasterId: 'cedar-point--magnum-xl-200', text: 'The 1989 hyper coaster that started the 200-foot club, still loved for its airtime hills.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-raptor', coasterId: 'cedar-point--raptor', text: 'A classic inverted coaster: feet dangling, six inversions, smooth and forceful.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'rides',
          title: 'Ride if you have time',
          items: [
            { id: 'tier-gemini', coasterId: 'cedar-point--gemini', text: 'Side-by-side racing trains. More fun with friends, and the line is usually short.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-blue-streak', coasterId: 'cedar-point--blue-streak', text: 'The park\'s oldest coaster, a wooden out-and-back with pops of airtime.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-rougarou', coasterId: 'cedar-point--rougarou', text: 'A floorless looper with four inversions. Solid, not special.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-wild-mouse', coasterId: 'cedar-point--wild-mouse', text: 'A spinning family coaster. Fun, but the line moves slowly.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'rides',
          title: 'For the credit',
          items: [
            { id: 'tier-mine-ride', coasterId: 'cedar-point--cedar-creek-mine-ride', text: 'A 1969 mine train: mild, a bit rough, quick to ride.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-corkscrew', coasterId: 'cedar-point--corkscrew', text: 'Short, rough, and historic. Ride it for the history.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-iron-dragon', coasterId: 'cedar-point--iron-dragon', text: 'A gentle suspended coaster that swings over the lagoon.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-woodstock', coasterId: 'cedar-point--woodstock-express', text: 'A junior coaster adults can ride too.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'tier-wilderness-run', coasterId: 'cedar-point--wilderness-run', text: 'A kiddie coaster with a 54-inch maximum height, so most adults can\'t ride it.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions', 'https://www.sixflags.com/cedarpoint/attractions/wilderness-run'] },
          ],
        },
        {
          type: 'list',
          title: 'Height and rider fit',
          items: [
            { id: 'fit-heights', text: '**Minimum heights:** 54 inches for Raptor and Rougarou; 52 for Steel Vengeance, Top Thrill 2, Maverick, GateKeeper, and Valravn; 48 for Millennium Force, Siren\'s Curse, Magnum XL-200, and most others. Check [each ride\'s page](https://www.sixflags.com/cedarpoint/attractions) before you go.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions', 'https://www.sixflags.com/cedarpoint/attractions/raptor', 'https://www.sixflags.com/cedarpoint/attractions/rougarou', 'https://www.sixflags.com/cedarpoint/attractions/steel-vengeance', 'https://www.sixflags.com/cedarpoint/attractions/top-thrill-2', 'https://www.sixflags.com/cedarpoint/attractions/maverick', 'https://www.sixflags.com/cedarpoint/attractions/gatekeeper', 'https://www.sixflags.com/cedarpoint/attractions/valravn', 'https://www.sixflags.com/cedarpoint/attractions/millennium-force', 'https://www.sixflags.com/cedarpoint/attractions/sirens-curse', 'https://www.sixflags.com/cedarpoint/attractions/magnum-xl-200'] },
            { id: 'fit-max', text: '**Maximum heights:** 78 inches on Millennium Force, Maverick, GateKeeper, and Rougarou; 80 on Siren\'s Curse.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/millennium-force', 'https://www.sixflags.com/cedarpoint/attractions/maverick', 'https://www.sixflags.com/cedarpoint/attractions/gatekeeper', 'https://www.sixflags.com/cedarpoint/attractions/rougarou', 'https://www.sixflags.com/cedarpoint/attractions/sirens-curse'] },
            { id: 'fit-test-seats', text: '**Test seats:** look for one at the entrance of the big coasters. If you\'re tall or larger, try it before you queue; the ride hosts can help.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/accessibility'] },
            { id: 'fit-access', text: 'Riding with a disability or need help with the rules? Read the [accessibility guide](https://www.sixflags.com/cedarpoint/accessibility) before your visit.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/accessibility'] },
            { id: 'fit-single', text: '**No single-rider lines** that we know of. Riding solo? Tell the host near the platform; they often fill empty seats with single riders.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/FAQ_Answers-g50940-d102765-t5635553-Is_there_a_line_for_single_riders_or_is_it_best.html'] },
          ],
        },
        { type: 'credits', show: 'checklist' },
        { type: 'p', id: 'must-legacy', text: '**Legacy credits.** Retired Cedar Point coasters you may have from older visits: Disaster Transport, Mean Streak, Top Thrill Dragster, Wicked Twister, and WildCat. Top Thrill 2 was rebuilt from Top Thrill Dragster, and Steel Vengeance from Mean Streak. Loop Troupe lists each as its own coaster, so you log them separately; how you count them is up to you.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://rcdb.com/4529.htm', 'https://en.wikipedia.org/wiki/Cedar_Point', 'https://en.wikipedia.org/wiki/Top_Thrill_2', 'https://en.wikipedia.org/wiki/Steel_Vengeance', 'https://en.wikipedia.org/wiki/WildCat_(Cedar_Point)'] },
      ],
    },

    {
      id: 'ride-plans',
      title: 'Ride-order plans',
      status: 'draft', lastVerified: null,
      answer: { id: 'plans-answer', text: 'Main gate, straight to Steel Vengeance at opening, Millennium Force if it\'s down, then Fast Lane for Top Thrill 2 and Siren\'s Curse.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
      blocks: [
        { type: 'p', id: 'plans-how', text: 'Pick the plan that fits your group. Times are estimates for a typical summer day; a **New credit** badge marks coasters you haven\'t logged yet.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        {
          type: 'plan',
          id: 'troupe-plan',
          title: 'The troupe\'s plan',
          steps: [
            { id: 'troupe-1', text: 'Get Fast Lane for the top rides.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-2', text: 'Enter through the main gate.', kind: 'fact', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-3', coasterId: 'cedar-point--steel-vengeance', time: 'Rope drop', text: 'Go straight to Steel Vengeance at the back of the park. When we went, it had the lowest crowds at the start of the day.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-4', coasterId: 'cedar-point--millennium-force', time: 'Plan B', text: 'Steel Vengeance down? Backtrack a bit and ride Millennium Force instead.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-5', coasterId: 'cedar-point--maverick', time: 'Early morning', text: 'Maverick is close by in Frontier Town, so ride it while you\'re at the back of the park.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'troupe-6', coasterId: 'cedar-point--millennium-force', time: 'Late morning', text: 'Head back toward the middle of the park for Millennium Force, if you didn\'t ride it first.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'troupe-7', coasterId: 'cedar-point--top-thrill-2', text: 'Use Fast Lane on Top Thrill 2.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-8', coasterId: 'cedar-point--siren-s-curse', text: 'Use Fast Lane on Siren\'s Curse.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-9', coasterId: 'cedar-point--steel-vengeance', text: 'Use Fast Lane on Steel Vengeance too.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'troupe-10', coasterId: 'cedar-point--gatekeeper', time: 'Afternoon', text: 'Must-rides done. Add GateKeeper, over the main gate.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.themeparkarchive.com/parks/cedar-point/entrance'] },
            { id: 'troupe-11', coasterId: 'cedar-point--valravn', time: 'Afternoon', text: 'Then Valravn, near the front of the park.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/', 'https://coasterbuzz.com/Forums/Topic/which-cedar-point-entrance'] },
            { id: 'troupe-12', time: 'Evening', text: 'Spend what\'s left on re-rides of your favorite, with Fast Lane.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'plan',
          id: 'every-credit',
          title: 'Every credit in one day',
          steps: [
            { id: 'every-1', coasterId: 'cedar-point--steel-vengeance', time: 'Rope drop', text: 'This plan assumes Fast Lane Plus and opening to close. Start with Steel Vengeance at the back.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'every-2', coasterId: 'cedar-point--maverick', time: 'Early morning', text: 'Maverick, next door in Frontier Town.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'every-3', coasterId: 'cedar-point--cedar-creek-mine-ride', time: 'Morning', text: 'Cedar Creek Mine Ride, on the way back along Frontier Trail.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'every-4', coasterId: 'cedar-point--woodstock-express', time: 'Morning', text: 'Woodstock Express in Camp Snoopy. Kids under 54 inches can add Wilderness Run here too.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://en.wikipedia.org/wiki/Cedar_Point', 'https://www.sixflags.com/cedarpoint/attractions/wilderness-run'] },
            { id: 'every-5', coasterId: 'cedar-point--millennium-force', time: 'Late morning', text: 'Millennium Force.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'every-6', coasterId: 'cedar-point--siren-s-curse', time: 'Late morning', text: 'Siren\'s Curse, close by on the Millennium Midway side.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'every-7', coasterId: 'cedar-point--rougarou', time: 'Midday', text: 'Rougarou.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'every-8', coasterId: 'cedar-point--iron-dragon', time: 'Midday', text: 'Iron Dragon, over the lagoon.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'every-9', coasterId: 'cedar-point--top-thrill-2', time: 'Early afternoon', text: 'Top Thrill 2 with Fast Lane. Eat after this, while the lunch rush clears.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'every-10', coasterId: 'cedar-point--gemini', time: 'Afternoon', text: 'Gemini.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'every-11', coasterId: 'cedar-point--magnum-xl-200', time: 'Afternoon', text: 'Magnum XL-200.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'every-12', coasterId: 'cedar-point--corkscrew', time: 'Late afternoon', text: 'Corkscrew.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'every-13', coasterId: 'cedar-point--blue-streak', time: 'Late afternoon', text: 'Blue Streak, then Raptor across the Main Midway (log both).', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'every-14', coasterId: 'cedar-point--valravn', time: 'Evening', text: 'Valravn.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'every-15', coasterId: 'cedar-point--gatekeeper', time: 'Evening', text: 'GateKeeper, then Wild Mouse nearby to finish (log both).', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
          ],
        },
        {
          type: 'plan',
          id: 'no-fast-lane',
          title: 'No Fast Lane',
          steps: [
            { id: 'nofl-1', coasterId: 'cedar-point--steel-vengeance', time: 'Rope drop', text: 'Same opening move: straight to Steel Vengeance.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'nofl-2', coasterId: 'cedar-point--maverick', time: 'Early morning', text: 'Maverick, while the back of the park is still quiet.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'nofl-3', coasterId: 'cedar-point--millennium-force', time: 'Before noon', text: 'Millennium Force before the crowds arrive.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
            { id: 'nofl-4', time: 'Midday', text: 'Midday is peak crowd time. Ride the classics with shorter lines (Gemini, Blue Streak, Corkscrew) and eat at an off-hour.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
            { id: 'nofl-5', coasterId: 'cedar-point--siren-s-curse', time: 'Late afternoon', text: 'Siren\'s Curse. Expect one of the longest waits of the day.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'nofl-6', coasterId: 'cedar-point--top-thrill-2', time: 'Last two hours', text: 'Top Thrill 2 in the last couple of hours, when lines usually drop.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
            { id: 'nofl-7', text: 'One line out of hand? Single-Use Fast Lane skips it once, without buying the full day.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
          ],
        },
        { type: 'p', tone: 'tip', id: 'plans-down', text: '**When a ride goes down:** don\'t wait at the entrance. Keep moving to the next ride in your plan and check back later; the official Six Flags app shows which rides are running.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/scheduled-ride-closures'] },
        {
          type: 'plan',
          id: 'family',
          title: 'Mixed heights or family',
          steps: [
            { id: 'family-1', text: 'Measure first. At 36 inches kids can ride Wilderness Run, and Woodstock Express with an adult; 42 inches adds Iron Dragon, and Wild Mouse with an adult; 48 opens most of the park.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wilderness-run', 'https://www.sixflags.com/cedarpoint/attractions/woodstock-express', 'https://www.sixflags.com/cedarpoint/attractions/iron-dragon', 'https://www.sixflags.com/cedarpoint/attractions/wild-mouse'] },
            { id: 'family-2', text: 'Taking turns on the big rides? Ask about Parent Swap at the ride entrance: one adult rides while the other waits with the kids, then they switch without queuing again.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://inacents.com/2014/05/29/cedar-point-parent-swap/', 'https://forums.pointbuzz.com/Forums/Topic/parent-swap--does-it-work'] },
            { id: 'family-3', coasterId: 'cedar-point--woodstock-express', time: 'Morning', text: 'Start small in Camp Snoopy with Woodstock Express.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'family-4', coasterId: 'cedar-point--wilderness-run', time: 'Morning', text: 'Wilderness Run, for riders up to 54 inches.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wilderness-run'] },
            { id: 'family-5', coasterId: 'cedar-point--iron-dragon', time: 'Late morning', text: 'Iron Dragon, the gentlest "big" coaster.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'family-6', coasterId: 'cedar-point--wild-mouse', time: 'Midday', text: 'Wild Mouse, for spinning.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'family-7', coasterId: 'cedar-point--cedar-creek-mine-ride', time: 'Afternoon', text: 'Cedar Creek Mine Ride, for 48-inch riders.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/cedar-creek-mine-ride'] },
            { id: 'family-8', coasterId: 'cedar-point--gemini', time: 'Afternoon', text: 'Gemini: race the other train.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'family-9', coasterId: 'cedar-point--blue-streak', time: 'Afternoon', text: 'Blue Streak, the classic woodie.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'family-10', coasterId: 'cedar-point--millennium-force', time: 'Late afternoon', text: 'Ready for a giant? Millennium Force takes riders from 48 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/millennium-force'] },
            { id: 'family-11', coasterId: 'cedar-point--siren-s-curse', time: 'Evening', text: 'Siren\'s Curse also starts at 48 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/sirens-curse'] },
            { id: 'family-12', coasterId: 'cedar-point--magnum-xl-200', time: 'Evening', text: 'Magnum XL-200 at 48 inches: big hills along the lake.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/magnum-xl-200'] },
          ],
        },
      ],
    },

    {
      id: 'ride-notes',
      title: 'Ride-by-ride notes',
      status: 'draft', lastVerified: null,
      answer: { id: 'notes-answer', text: 'Every operating coaster: our verdict, best seat, waits, and the rules that catch people out. Tap "ridden" to log a credit.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'rides',
          items: [
            { id: 'sv-verdict', coasterId: 'cedar-point--steel-vengeance', label: 'Verdict', text: '**Must-ride.** Our first ride of the day, straight from the main gate.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'sv-why', coasterId: 'cedar-point--steel-vengeance', label: 'Why ride', text: 'A 205-foot wood-and-steel hybrid packed with **airtime** (that floating, out-of-your-seat feeling): about two and a half minutes of hills, four inversions, and barely a breath.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/steel-vengeance', 'https://en.wikipedia.org/wiki/Steel_Vengeance'] },
            { id: 'sv-seat', coasterId: 'cedar-point--steel-vengeance', label: 'Best seat', text: 'Back row for the wildest airtime; front row for the view.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'sv-waits', coasterId: 'cedar-point--steel-vengeance', label: 'Waits', text: 'Shortest at opening and in the last hour; long by midday. Fast Lane Plus covers it.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane', 'https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
            { id: 'sv-loose', coasterId: 'cedar-point--steel-vengeance', label: 'Loose articles', text: 'No bags, hats, or loose items in line. Leave them with a non-rider or in the paid lockers at the entrance; everyone goes through a metal detector. Small items go in lockers inside the queue.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/steel-vengeance'] },
            { id: 'sv-fit', coasterId: 'cedar-point--steel-vengeance', label: 'Rider fit', text: '52-inch minimum. Lap bar only, no shoulder restraint.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/steel-vengeance'] },
            { id: 'tt2-verdict', coasterId: 'cedar-point--top-thrill-2', label: 'Verdict', text: '**Must-ride.** One of the top rides we\'d use Fast Lane for.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'tt2-why', coasterId: 'cedar-point--top-thrill-2', label: 'Why ride', text: 'Three launches (forward, backward, forward again) over a 420-foot top hat at up to 120 mph. Rebuilt from Top Thrill Dragster in 2024.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/top-thrill-2', 'https://en.wikipedia.org/wiki/Top_Thrill_2', 'https://www.sixflags.com/cedarpoint/early-entry'] },
            { id: 'tt2-downtime', coasterId: 'cedar-point--top-thrill-2', label: 'Downtime', text: 'It sat out nearly all of 2024 and can stop for wind. If it\'s running, ride it now.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://en.wikipedia.org/wiki/Top_Thrill_2', 'https://www.wkyc.com/article/entertainment/places/cedar-point/cedar-point-top-thrill-2-update-roller-coaster-closed-2024-season-update-zamperla-park-statement/95-43c61852-f3b5-47ae-8e67-a880681ec20f'] },
            { id: 'tt2-waits', coasterId: 'cedar-point--top-thrill-2', label: 'Waits', text: 'One of the longest lines in the park. Fast Lane Plus covers it.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'tt2-loose', coasterId: 'cedar-point--top-thrill-2', label: 'Loose articles', text: 'No bags, hats, or loose items in line. Leave them with a non-rider or in the paid lockers at the entrance; everyone goes through a metal detector.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/top-thrill-2'] },
            { id: 'tt2-fit', coasterId: 'cedar-point--top-thrill-2', label: 'Rider fit', text: '52-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/top-thrill-2'] },
            { id: 'sc-verdict', coasterId: 'cedar-point--siren-s-curse', label: 'Verdict', text: '**Must-ride.** One of the top rides we\'d use Fast Lane for.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'sc-why', coasterId: 'cedar-point--siren-s-curse', label: 'Why ride', text: 'A tilt coaster from 2025: the train stops on a piece of track that tips forward until you\'re facing straight down, then lets go. North America\'s tallest and fastest of its kind.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/sirens-curse', 'https://en.wikipedia.org/wiki/Siren%27s_Curse'] },
            { id: 'sc-waits', coasterId: 'cedar-point--siren-s-curse', label: 'Waits', text: 'New and popular, so expect a long line most of the day. Fast Lane Plus covers it.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'sc-loose', coasterId: 'cedar-point--siren-s-curse', label: 'Loose articles', text: 'No loose items in line. Lockers are by the ride exit, everyone goes through a metal detector, and small items go in lockers inside the queue.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/sirens-curse'] },
            { id: 'sc-fit', coasterId: 'cedar-point--siren-s-curse', label: 'Rider fit', text: '48 to 80 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/sirens-curse'] },
            { id: 'mf-verdict', coasterId: 'cedar-point--millennium-force', label: 'Verdict', text: '**Must-ride**, and our backup first ride when Steel Vengeance is down.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'mf-why', coasterId: 'cedar-point--millennium-force', label: 'Why ride', text: 'The 300-foot-plus giga coaster from 2000 still feels enormous: a long, steep first drop, huge speed, and sweeping turns over the lagoon.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/millennium-force', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'mf-seat', coasterId: 'cedar-point--millennium-force', label: 'Best seat', text: 'Front row for the view from the top; back row for the strongest pull down the first drop.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mf-night', coasterId: 'cedar-point--millennium-force', label: 'At night', text: 'One of the best night rides in the park, if it\'s open late.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mf-loose', coasterId: 'cedar-point--millennium-force', label: 'Loose articles', text: 'No bags or loose items in line or on the ride: use the lockers by the entrance.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'mf-fit', coasterId: 'cedar-point--millennium-force', label: 'Rider fit', text: '48 to 78 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/millennium-force'] },
            { id: 'mav-verdict', coasterId: 'cedar-point--maverick', label: 'Verdict', text: '**Must-ride.**', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'mav-why', coasterId: 'cedar-point--maverick', label: 'Why ride', text: 'Short and intense: two launches, a first drop steeper than vertical, and a dark tunnel. Proof a ride doesn\'t need to be tall to be wild.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/maverick', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'mav-seat', coasterId: 'cedar-point--maverick', label: 'Best seat', text: 'Back row for the strongest pull over the first drop.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mav-waits', coasterId: 'cedar-point--maverick', label: 'Waits', text: 'Small trains mean a slow-moving line. Ride it early, or use Fast Lane Plus.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'mav-fit', coasterId: 'cedar-point--maverick', label: 'Rider fit', text: '52 to 78 inches. The restraints can feel snug for larger riders; try the test seat first.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/maverick'] },
            { id: 'gk-verdict', coasterId: 'cedar-point--gatekeeper', label: 'Verdict', text: '**Also great.** The troupe enjoyed it.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'gk-why', coasterId: 'cedar-point--gatekeeper', label: 'Why ride', text: 'A wing coaster: seats hang off both sides of the track with nothing above or below you, and it swoops through the two keyholes over the main gate.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/gatekeeper', 'https://www.themeparkarchive.com/parks/cedar-point/entrance'] },
            { id: 'gk-seat', coasterId: 'cedar-point--gatekeeper', label: 'Best seat', text: 'An outside seat, for the most open-air feeling.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'gk-loose', coasterId: 'cedar-point--gatekeeper', label: 'Loose articles', text: 'No bags or loose items in line or on the ride: use the lockers by the entrance.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'gk-fit', coasterId: 'cedar-point--gatekeeper', label: 'Rider fit', text: '52 to 78 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/gatekeeper'] },
            { id: 'val-verdict', coasterId: 'cedar-point--valravn', label: 'Verdict', text: '**Also great.** The troupe enjoyed it.', kind: 'take', volatility: 'stable', status: 'verified', lastVerified: '2026-10-02', verifiedBy: 'Loop Troupe team', basis: 'First-hand, team notes reported 2026-10-02 (visit date to confirm)', sources: ['docs/guides/cedar-point-team-notes.md (2026-10-02)'] },
            { id: 'val-why', coasterId: 'cedar-point--valravn', label: 'Why ride', text: 'A dive coaster: the train hangs over a vertical drop for a long, nervous moment before it lets go. Three inversions follow.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/valravn', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'val-seat', coasterId: 'cedar-point--valravn', label: 'Best seat', text: 'Front row, for the full view straight down during the hold.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'val-waits', coasterId: 'cedar-point--valravn', label: 'Waits', text: 'Often a long line. Fast Lane Plus covers it.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/fast-lane'] },
            { id: 'val-loose', coasterId: 'cedar-point--valravn', label: 'Loose articles', text: 'No bags or loose items in line or on the ride: use the lockers by the entrance.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'val-fit', coasterId: 'cedar-point--valravn', label: 'Rider fit', text: '52-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/valravn'] },
            { id: 'mag-verdict', coasterId: 'cedar-point--magnum-xl-200', label: 'Verdict', text: 'Worth the wait. The 1989 coaster that broke 200 feet first, and its run of hills back along the lakeshore is pure airtime.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/magnum-xl-200', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'mag-seat', coasterId: 'cedar-point--magnum-xl-200', label: 'Best seat', text: 'The back half of the train for the most airtime.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mag-night', coasterId: 'cedar-point--magnum-xl-200', label: 'At night', text: 'Great at dusk, with the lake beside you.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mag-loose', coasterId: 'cedar-point--magnum-xl-200', label: 'Loose articles', text: 'No bags or loose items in line or on the ride: use the lockers by the entrance.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'mag-fit', coasterId: 'cedar-point--magnum-xl-200', label: 'Rider fit', text: '48-inch minimum. Lap bar only.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/magnum-xl-200'] },
            { id: 'rap-verdict', coasterId: 'cedar-point--raptor', label: 'Verdict', text: 'Worth the wait. A classic inverted coaster from 1994: your feet dangle and it rolls through six inversions, smooth and forceful.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/raptor', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'rap-seat', coasterId: 'cedar-point--raptor', label: 'Best seat', text: 'Front row, for an unobstructed view with nothing in front of your feet.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'rap-waits', coasterId: 'cedar-point--raptor', label: 'Waits', text: 'Near the main gate, so it\'s busiest in the morning and quieter later.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'rap-fit', coasterId: 'cedar-point--raptor', label: 'Rider fit', text: '54-inch minimum, the tallest in the park.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/raptor'] },
            { id: 'rap-loose', coasterId: 'cedar-point--raptor', label: 'Loose articles', text: 'Inverted, so empty your pockets into a locker before you board.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'rou-verdict', coasterId: 'cedar-point--rougarou', label: 'Verdict', text: 'If you have time. A floorless coaster (your feet dangle over the track) with four inversions, converted from the stand-up Mantis in 2015.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/rougarou', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'rou-waits', coasterId: 'cedar-point--rougarou', label: 'Waits', text: 'Usually moderate. In fall 2026 it was closed on Thursdays and opened at noon Friday to Sunday.', kind: 'estimate', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/scheduled-ride-closures'] },
            { id: 'rou-loose', coasterId: 'cedar-point--rougarou', label: 'Loose articles', text: 'No bags or loose items in line or on the ride: use the lockers by the entrance.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
            { id: 'rou-fit', coasterId: 'cedar-point--rougarou', label: 'Rider fit', text: '54 to 78 inches.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/rougarou'] },
            { id: 'gem-verdict', coasterId: 'cedar-point--gemini', label: 'Verdict', text: 'If you have time. Two trains race side by side; grab friends for the other train and see who wins.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/gemini', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'gem-waits', coasterId: 'cedar-point--gemini', label: 'Waits', text: 'Usually short. In fall 2026 it was closed on Thursdays and opened at noon Friday to Sunday.', kind: 'estimate', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/scheduled-ride-closures'] },
            { id: 'gem-fit', coasterId: 'cedar-point--gemini', label: 'Rider fit', text: '48-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/gemini'] },
            { id: 'gem-seat', coasterId: 'cedar-point--gemini', label: 'Best seat', text: 'Back row on either side for the best pops of airtime.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'gem-night', coasterId: 'cedar-point--gemini', label: 'At night', text: 'Fun after dark when the midway lights come on, and the line stays short.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'bs-verdict', coasterId: 'cedar-point--blue-streak', label: 'Verdict', text: 'If you have time. Cedar Point\'s oldest coaster (1964): a wooden out-and-back with friendly pops of airtime. A good palate cleanser between giants.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/blue-streak', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'bs-seat', coasterId: 'cedar-point--blue-streak', label: 'Best seat', text: 'Back row for the most airtime.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'bs-waits', coasterId: 'cedar-point--blue-streak', label: 'Waits', text: 'Rarely long, even on busy days. A good one to fill a gap between Fast Lane rides.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'bs-night', coasterId: 'cedar-point--blue-streak', label: 'At night', text: 'A classic night ride: the turnaround at the front of the park is dark and quick.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'bs-fit', coasterId: 'cedar-point--blue-streak', label: 'Rider fit', text: '48-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/blue-streak'] },
            { id: 'wm-verdict', coasterId: 'cedar-point--wild-mouse', label: 'Verdict', text: 'If you have time. A spinning family coaster from 2023: tight turns and four-seat cars that spin freely, so no two rides match.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wild-mouse', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'wm-waits', coasterId: 'cedar-point--wild-mouse', label: 'Waits', text: 'The cars hold four, so the line moves slowly for a family ride. Go early or late.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wild-mouse'] },
            { id: 'wm-fit', coasterId: 'cedar-point--wild-mouse', label: 'Rider fit', text: '48 inches to ride alone; 42 to 48 with an adult.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wild-mouse'] },
            { id: 'ccmr-verdict', coasterId: 'cedar-point--cedar-creek-mine-ride', label: 'Verdict', text: 'For the credit. A 1969 mine train, mild and a bit rough. Quick to ride, and you\'ll pass it on Frontier Trail anyway.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/cedar-creek-mine-ride', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'ccmr-waits', coasterId: 'cedar-point--cedar-creek-mine-ride', label: 'Waits', text: 'Usually short. In fall 2026 it opened at noon Friday to Sunday.', kind: 'estimate', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/scheduled-ride-closures'] },
            { id: 'ccmr-seat', coasterId: 'cedar-point--cedar-creek-mine-ride', label: 'Best seat', text: 'Toward the back, for a little more speed on the drops.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'ccmr-fit', coasterId: 'cedar-point--cedar-creek-mine-ride', label: 'Rider fit', text: '48-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/cedar-creek-mine-ride'] },
            { id: 'cork-verdict', coasterId: 'cedar-point--corkscrew', label: 'Verdict', text: 'For the credit. The 1976 looper was the first with three inversions, and it still flips over the midway. Short and a little rough; ride it for the history.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/corkscrew', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'cork-waits', coasterId: 'cedar-point--corkscrew', label: 'Waits', text: 'Usually short.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'cork-nearby', coasterId: 'cedar-point--corkscrew', label: 'Nearby', text: 'It sits by the Top Thrill 2 midway, so grab it in passing on the way to or from Top Thrill 2.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://en.wikipedia.org/wiki/Cedar_Point', 'https://deeparrival.com/theme-parks/cedar-point/park-map/'] },
            { id: 'cork-fit', coasterId: 'cedar-point--corkscrew', label: 'Rider fit', text: '48-inch minimum, with over-the-shoulder restraints.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/corkscrew'] },
            { id: 'id-verdict', coasterId: 'cedar-point--iron-dragon', label: 'Verdict', text: 'For the credit. A gentle 1987 suspended coaster whose cars swing out over the lagoon. Pretty, not scary: a good first "big" coaster for kids.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/iron-dragon', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'id-waits', coasterId: 'cedar-point--iron-dragon', label: 'Waits', text: 'Usually short. It was on the 2026 Early Entry list.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/early-entry'] },
            { id: 'id-tip', coasterId: 'cedar-point--iron-dragon', label: 'Nearby', text: 'It runs over the lagoon on the Millennium Midway side, so it\'s an easy add-on while you\'re near Millennium Force.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://deeparrival.com/theme-parks/cedar-point/park-map/', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'id-fit', coasterId: 'cedar-point--iron-dragon', label: 'Rider fit', text: '42-inch minimum.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/iron-dragon'] },
            { id: 'we-verdict', coasterId: 'cedar-point--woodstock-express', label: 'Verdict', text: 'For the credit. A junior coaster in Camp Snoopy that adults can ride too, and a fine first coaster for kids.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/woodstock-express', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'we-fit', coasterId: 'cedar-point--woodstock-express', label: 'Rider fit', text: '48 inches to ride alone; 36 to 48 with an adult.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/woodstock-express'] },
            { id: 'we-waits', coasterId: 'cedar-point--woodstock-express', label: 'Waits', text: 'Short most of the day; busiest mid-morning, when families arrive in Camp Snoopy.', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'we-tip', coasterId: 'cedar-point--woodstock-express', label: 'Credit tip', text: 'Adults can ride without a child. Log it and move on.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'wr-verdict', coasterId: 'cedar-point--wilderness-run', label: 'Verdict', text: 'For young riders. Cedar Point\'s smallest coaster, from 1979, and the first coaster Intamin ever built.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wilderness-run', 'https://en.wikipedia.org/wiki/Cedar_Point'] },
            { id: 'wr-fit', coasterId: 'cedar-point--wilderness-run', label: 'Rider fit', text: '36 to 54 inches, so most adults can\'t ride it.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wilderness-run'] },
            { id: 'wr-family', coasterId: 'cedar-point--wilderness-run', label: 'For families', text: 'A good first coaster: a 19-foot hill, gentle turns, and a trip through the woods of Camp Snoopy.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/attractions/wilderness-run'] },
            { id: 'wr-nearby', coasterId: 'cedar-point--wilderness-run', label: 'Nearby', text: 'In Camp Snoopy with Woodstock Express, so families can collect both credits in one stop.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://en.wikipedia.org/wiki/Cedar_Point'] },
          ],
        },
      ],
    },

    {
      id: 'food',
      title: 'Food and breaks',
      status: 'draft', lastVerified: null,
      answer: { id: 'food-answer', text: 'Eat before 11:30 or after 2 to skip the rush, and price out a dining plan if you\'ll eat two meals in the park.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/daily-drinks-dining'] },
      blocks: [
        {
          type: 'picks',
          kind: 'food',
          title: 'Places to try',
          items: [
            { id: 'food-farmhouse', name: 'Farmhouse Kitchen & Grill', location: 'Frontier Town', bestFor: 'Lunch near Steel Vengeance', text: 'A full meal at the back of the park, so you don\'t walk to the front to eat after your Steel Vengeance morning. Takes the dining plan.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/drinks-dining-deals', 'http://www.insidersofthepoint.com/the-farmhouse-kitchen-and-grill.html'] },
            { id: 'food-backbeatque', name: 'BackBeatQue', location: 'Near Magnum XL-200', bestFor: 'Barbecue', text: 'Barbecue in the middle of the park. Takes the dining plan.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/drinks-dining-deals', 'https://www.wkyc.com/article/entertainment/places/cedar-point/cedar-point-opens-2-new-restaurants-for-2019-first-look/95-21fc2264-4134-4c4b-8cdf-31b09f7268f0'] },
            { id: 'food-hugos', name: 'Hugo\'s Italian Kitchen', location: 'Main Midway, by Raptor', bestFor: 'Pizza and pasta', text: 'Pizza and pasta near the front, handy at the start or end of the day. Takes the dining plan.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/drinks-dining-deals', 'https://www.wkyc.com/article/entertainment/places/cedar-point/cedar-point-opens-2-new-restaurants-for-2019-first-look/95-21fc2264-4134-4c4b-8cdf-31b09f7268f0'] },
            { id: 'food-friar', name: 'Happy Friar', bestFor: 'A snack between rides', text: 'Fresh-cut fries are a Cedar Point tradition; the park even runs a fries festival. Takes the dining plan.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/drinks-dining-deals', 'https://www.sixflags.com/blog/blog/cedar-point-2026-whats-new'] },
          ],
        },
        { type: 'p', id: 'food-plan', text: '**Dining plans:** a Single Meal Deal, or All Day Dining (an entrée with a side every 90 minutes), plus drink plans with refills. If you\'ll eat two meals in the park, compare today\'s [plan prices](https://www.sixflags.com/cedarpoint/daily-drinks-dining) with the menus.', kind: 'take', volatility: 'volatile', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/daily-drinks-dining', 'https://www.sixflags.com/cedarpoint/drinks-dining-deals'] },
        { type: 'p', id: 'food-timing', text: 'Lunch lines peak from about 11:30 to 1:30, and dinner around 5 to 7. Eat early or late, and ride while everyone else is eating. A sit-down spot at the back of the park, like Farmhouse Kitchen, makes a good midday reset after a Frontier Town morning.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.tripadvisor.com/ShowTopic-g50940-i266-k13763799-Cedar_point_best_time_to_go_Least_busy-Sandusky_Ohio.html'] },
        { type: 'p', tone: 'tip', id: 'food-water', text: '**Water:** you can bring in unopened plastic bottles of water, but no other outside food, drinks, or coolers. Quick-service counters will usually give you a cup of ice water if you ask.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
        { type: 'p', id: 'food-break', text: '**Breaks:** the beach is open to park guests if you want sand and a breeze. Wi-Fi is free across the park, but bring a battery pack: a long day of the park app drains a phone.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/frequently-asked-questions'] },
        { type: 'p', id: 'food-dietary', text: 'Allergies or a special diet? See the park\'s [dietary needs page](https://www.sixflags.com/cedarpoint/dietary-needs).', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.sixflags.com/cedarpoint/dietary-needs'] },
      ],
    },

    {
      id: 'videos',
      title: 'Video picks',
      status: 'draft', lastVerified: null,
      answer: { id: 'videos-answer', text: 'One front-row ride video for each must-ride, plus two for planning. Nothing loads until you tap Play.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'videos',
          title: 'Must-rides, front row',
          items: [
            { id: 'video-sv-pov', title: 'Steel Vengeance, front row (2023)', creator: 'ThemeParkMark', creatorUrl: 'https://www.youtube.com/@themeparkmark1', videoId: '1m1DWbDSM2E', coasterId: 'cedar-point--steel-vengeance', text: 'Sharp, steady front-row footage: see the airtime hills before you queue.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=1m1DWbDSM2E'] },
            { id: 'video-tt2-pov', title: 'Top Thrill 2, front row', creator: 'Thrill POVs', creatorUrl: 'https://www.youtube.com/@thrillpovs', videoId: 'tH8xM4SjvE4', coasterId: 'cedar-point--top-thrill-2', text: 'All three launches, so you know what the backward one feels like.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=tH8xM4SjvE4'] },
            { id: 'video-sc-pov', title: 'Siren\'s Curse on-ride (2026)', creator: 'JohnYChen', creatorUrl: 'https://www.youtube.com/@johnychen', videoId: 'OZnm8NLn2Kw', coasterId: 'cedar-point--siren-s-curse', text: 'Shows the tilt moment, the part everyone asks about.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=OZnm8NLn2Kw'] },
            { id: 'video-mf-pov', title: 'Millennium Force, front row (2026)', creator: 'ThemeParkMark', creatorUrl: 'https://www.youtube.com/@themeparkmark1', videoId: 'vayrviqSHTs', coasterId: 'cedar-point--millennium-force', text: 'A recent ride: the lift hill alone sells it.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=vayrviqSHTs'] },
            { id: 'video-mav-pov', title: 'Maverick, front row', creator: 'Thrill POVs', creatorUrl: 'https://www.youtube.com/@thrillpovs', videoId: 'mFWng0c8IPE', coasterId: 'cedar-point--maverick', text: 'Both launches and the tunnel, in under two minutes.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=mFWng0c8IPE'] },
          ],
        },
        {
          type: 'videos',
          title: 'For planning',
          items: [
            { id: 'video-overview', title: 'Cedar Point 2026 complete guide', creator: 'Kerney-cation', creatorUrl: 'https://www.youtube.com/@kerney-cation', videoId: 'uyFXNpdRWSw', text: 'A recent, practical walk through tickets, timing, and mistakes to avoid.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=uyFXNpdRWSw'] },
            { id: 'video-every-coaster', title: 'Every Cedar Point coaster, front row (2026)', creator: 'Thrill POVs', creatorUrl: 'https://www.youtube.com/@thrillpovs', videoId: 'S9hArBt9MPk', text: 'The whole credit list in one video: good for deciding your tiers.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null, sources: ['https://www.youtube.com/watch?v=S9hArBt9MPk'] },
          ],
        },
      ],
    },

    {
      id: 'freshness',
      title: 'Freshness and about this guide',
      status: 'draft', lastVerified: null,
      answer: { id: 'fresh-answer', text: 'Each section shows when our crew last checked it. We re-check before every season and after big park announcements.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        { type: 'p', id: 'fresh-how', text: 'Our crew has visited Cedar Point twice. This guide starts from their first-hand notes; public research fills the gaps and goes live only after a team member checks it. We re-check everything before each season opens and after major announcements, and fix reported mistakes within 7 days.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        { type: 'p', id: 'fresh-labels', text: '**What the labels mean:** "Unconfirmed" is something we haven\'t checked ourselves yet, so check before you rely on it. "Estimate" marks times and waits: our best guess, not a promise.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        { type: 'p', id: 'fresh-independence', text: 'Loop Troupe isn\'t affiliated with Cedar Point or Six Flags. We use park and ride names only to identify them. Prices, hours, and rules change often; the [official site](https://www.sixflags.com/cedarpoint) always wins.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        { type: 'p', id: 'fresh-report', text: 'Spotted something out of date? A way to send us fixes is coming before this guide goes live.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
      ],
    },

  ],

  // Newest first. Plain dated notes (not claims), shown in the Freshness section.
  changelog: [
    { date: '2026-10-02', text: 'First full draft, built from the team\'s notes plus public research. Research is unverified until the team checks it.' },
  ],
};
