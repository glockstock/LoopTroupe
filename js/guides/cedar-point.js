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

   Everything below is a PLACEHOLDER skeleton. Replace the text, keep the shape. */
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
  credits: {
    id: 'credits-operating',
    operating: [
      'cedar-point--steel-vengeance',
      'cedar-point--millennium-force',
      'cedar-point--maverick',
      'cedar-point--top-thrill-2',
      'cedar-point--siren-s-curse',
      'cedar-point--magnum-xl-200',
      'cedar-point--gatekeeper',
      'cedar-point--valravn',
      'cedar-point--raptor',
      'cedar-point--rougarou',
      'cedar-point--gemini',
      'cedar-point--blue-streak',
      'cedar-point--cedar-creek-mine-ride',
      'cedar-point--corkscrew',
      'cedar-point--iron-dragon',
      'cedar-point--wildcat',
      'cedar-point--wilderness-run',
      'cedar-point--woodstock-express',
    ],
    text: 'PLACEHOLDER — coaster_data_curator confirms the operating list against the official ride list; retired or renamed coasters must not appear here.',
    kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null,
  },

  sections: [
    {
      id: 'at-a-glance',
      title: 'At a glance',
      status: 'draft', lastVerified: null,
      answer: { id: 'glance-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        { type: 'p', id: 'glance-who', text: 'PLACEHOLDER — who this guide is for.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
        {
          type: 'facts',
          items: [
            { id: 'glance-days', label: 'Days needed', text: 'PLACEHOLDER', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'glance-credits', label: 'Operating coasters', text: 'PLACEHOLDER', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'list',
          title: 'Three things that matter most',
          ordered: true,
          items: [
            { id: 'glance-top-1', text: 'PLACEHOLDER — first thing', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'glance-top-2', text: 'PLACEHOLDER — second thing', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'glance-top-3', text: 'PLACEHOLDER — third thing', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        // "Your Cedar Point credits": count plus the coasters still to ride.
        { type: 'credits', show: 'summary' },
      ],
    },

    {
      id: 'when-to-go',
      title: 'When to go',
      status: 'draft', lastVerified: null,
      answer: { id: 'when-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null },
      blocks: [
        { type: 'p', id: 'when-months', text: 'PLACEHOLDER — best months and weekdays; link the [official calendar](https://www.cedarpoint.com/) for hours.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null },
        {
          type: 'list',
          items: [
            { id: 'when-crowds', text: 'PLACEHOLDER — crowd pattern', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'when-wind', text: 'PLACEHOLDER — weather and wind closures', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        { type: 'p', tone: 'tip', id: 'when-tip', text: 'PLACEHOLDER — one **tip** callout example.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      ],
    },

    {
      id: 'getting-in',
      title: 'Getting there and getting in',
      status: 'draft', lastVerified: null,
      answer: { id: 'in-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        { type: 'p', id: 'in-parking', text: 'PLACEHOLDER — parking and arrival.', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null },
        {
          type: 'picks',
          kind: 'gate',
          items: [
            { id: 'gate-main', name: 'PLACEHOLDER — gate name', bestFor: 'PLACEHOLDER — which plan it suits', text: 'PLACEHOLDER', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'gate-alt', name: 'PLACEHOLDER — second gate', bestFor: 'PLACEHOLDER', text: 'PLACEHOLDER — a team guess ("there\'s probably a better gate") becomes needs-check once written; placeholders stay draft.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        { type: 'p', tone: 'warning', id: 'in-bags', text: 'PLACEHOLDER — bag and locker policy; link the official page instead of restating it.', kind: 'fact', volatility: 'volatile', status: 'draft', lastVerified: null },
      ],
    },

    {
      id: 'must-rides',
      title: 'Must-rides and your credit checklist',
      status: 'draft', lastVerified: null,
      answer: { id: 'must-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'rides',
          title: 'PLACEHOLDER — The must-rides',
          ranked: true,
          items: [
            { id: 'must-steel-vengeance', coasterId: 'cedar-point--steel-vengeance', text: 'PLACEHOLDER — one-line why', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'must-millennium-force', coasterId: 'cedar-point--millennium-force', text: 'PLACEHOLDER — one-line why', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'rides',
          title: 'PLACEHOLDER — Also great',
          items: [
            { id: 'also-gatekeeper', coasterId: 'cedar-point--gatekeeper', text: 'PLACEHOLDER — one-line why', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        // Full checklist of every operating coaster with ridden toggles.
        { type: 'credits', show: 'checklist' },
      ],
    },

    {
      id: 'ride-plans',
      title: 'Ride-order plans',
      status: 'draft', lastVerified: null,
      answer: { id: 'plans-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'plan',
          id: 'troupe-plan',
          title: 'PLACEHOLDER — The troupe\'s plan',
          steps: [
            { id: 'troupe-1', text: 'PLACEHOLDER — non-ride step (enter at a gate)', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'troupe-2', coasterId: 'cedar-point--steel-vengeance', time: 'PLACEHOLDER — e.g. rope drop', text: 'PLACEHOLDER — step note', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'troupe-3', coasterId: 'cedar-point--top-thrill-2', time: 'PLACEHOLDER — e.g. about 11:00', text: 'PLACEHOLDER — step note', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
        {
          type: 'plan',
          id: 'every-credit',
          title: 'PLACEHOLDER — Every credit in one day',
          steps: [
            { id: 'every-1', coasterId: 'cedar-point--woodstock-express', text: 'PLACEHOLDER — step note', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
      ],
    },

    {
      id: 'ride-notes',
      title: 'Ride-by-ride notes',
      status: 'draft', lastVerified: null,
      answer: { id: 'notes-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'rides',
          // Several items per coaster; the renderer groups them by coasterId.
          items: [
            { id: 'mf-verdict', coasterId: 'cedar-point--millennium-force', label: 'Verdict', text: 'PLACEHOLDER', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mf-seat', coasterId: 'cedar-point--millennium-force', label: 'Best seat', text: 'PLACEHOLDER', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            { id: 'mf-waits', coasterId: 'cedar-point--millennium-force', label: 'Waits', text: 'PLACEHOLDER', kind: 'estimate', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'tt2-loose', coasterId: 'cedar-point--top-thrill-2', label: 'Loose articles', text: 'PLACEHOLDER', kind: 'fact', volatility: 'seasonal', status: 'draft', lastVerified: null },
          ],
        },
      ],
    },

    {
      id: 'food',
      title: 'Food and breaks',
      status: 'draft', lastVerified: null,
      answer: { id: 'food-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'picks',
          kind: 'food',
          items: [
            { id: 'food-best-bet', name: 'PLACEHOLDER — food spot', location: 'PLACEHOLDER — park area', bestFor: 'PLACEHOLDER — best bet', text: 'PLACEHOLDER', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null },
            { id: 'food-value', name: 'PLACEHOLDER — food spot', location: 'PLACEHOLDER', bestFor: 'PLACEHOLDER — value pick', text: 'PLACEHOLDER', kind: 'take', volatility: 'seasonal', status: 'draft', lastVerified: null },
          ],
        },
        { type: 'p', id: 'food-timing', text: 'PLACEHOLDER — when to eat to dodge the rush.', kind: 'estimate', volatility: 'stable', status: 'draft', lastVerified: null },
      ],
    },

    {
      id: 'videos',
      title: 'Video picks',
      status: 'draft', lastVerified: null,
      answer: { id: 'videos-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        {
          type: 'videos',
          items: [
            // YouTube pick: videoId is the 11-character ID from the watch URL.
            { id: 'video-sv-pov', title: 'PLACEHOLDER — video title', creator: 'PLACEHOLDER — creator name', creatorUrl: null, videoId: null, coasterId: 'cedar-point--steel-vengeance', text: 'PLACEHOLDER — why watch it', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
            // Other platforms: give `url` instead of videoId (shown as a link, never embedded).
            { id: 'video-overview', title: 'PLACEHOLDER — video title', creator: 'PLACEHOLDER — creator name', creatorUrl: null, url: null, text: 'PLACEHOLDER — why watch it', kind: 'take', volatility: 'stable', status: 'draft', lastVerified: null },
          ],
        },
      ],
    },

    {
      id: 'freshness',
      title: 'Freshness and about this guide',
      status: 'draft', lastVerified: null,
      answer: { id: 'fresh-answer', text: 'PLACEHOLDER — one-line answer, 25 words or fewer.', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
      blocks: [
        { type: 'p', id: 'fresh-how', text: 'PLACEHOLDER — how and when we re-verify, who checks, and how to report a fix (Q-028).', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        { type: 'p', id: 'fresh-independence', text: 'PLACEHOLDER — independence note (not affiliated with the park).', kind: 'fact', volatility: 'stable', status: 'draft', lastVerified: null },
        // The renderer adds the per-section sign-off table and the changelog here.
      ],
    },
  ],

  // Newest first. Plain dated notes (not claims), shown in the Freshness section.
  changelog: [
    { date: '2026-10-02', text: 'Guide skeleton created; all content is placeholder.' },
  ],
};
