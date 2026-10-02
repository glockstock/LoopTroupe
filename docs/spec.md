# Loop Troupe — Product Spec

Owner: `product_manager` (sole editor; see AGENTS.md). Status as of 2026-10-02.

## Owner direction

The user's own words. Preserve verbatim; organize derived requirements below.

> "This should be a website that allows roller coaster enthusiasts to track their 'credits' a term for the coasters they've ridden. They can see every coaster in every park in America to start. They can log that they rode it and leave a review of that ride. Make this a beautiful website. Host this on my GitHub io pages."

> "Make sure this is mobile friendly. Also make the visual style in the style of roller coaster tycoon, the video game. The pixel art of the coasters, isometric views of them when you visualize the park, and the fonts and colors schemes that add whimsy."

> "I want a retro feel, like roller coaster tycoon, but the current page could be improved."

Earlier repository tagline: "Loop Troupe: Goodreads for roller coasters."

## Vision

Loop Troupe is Goodreads for roller coasters: the place an enthusiast keeps their riding life. Every credit, every review, and every park they've conquered, wrapped in the nostalgic charm of a 1990s theme-park sim.

## Audience

Roller coaster enthusiasts who count credits: they plan trips around new coasters, remember their first ride on a favorite, and like seeing their progress add up. The core moments are logging a ride on a phone at the park, back-logging a long riding history at home, and looking back at what they've done.

## Shipped capabilities (MVP)

- **Database:** every roller coaster in every US park, including defunct parks and coasters for legacy credits (curated; see `coaster_data_curator`).
- **Browse:** parks (search, state filter, sort, defunct toggle), park detail, and an A–Z index of every coaster.
- **Log a credit:** one-tap "ridden" toggle, or a full log with first-ride date, times ridden, a 1–5 star rating, and a written review. Edit or remove later.
- **Progress:** total credits, parks visited, states, average rating, per-park completion, a state "passport," and an isometric park diorama that colors in as coasters are ridden.
- **My Credits:** the full numbered history, with JSON backup export and import.
- **Local-first:** ride data stays in the rider's browser. No accounts.
- **Hosting:** GitHub Pages at https://glockstock.github.io/LoopTroupe/.
- **Mobile friendly** at phone widths.

## Experience direction

Retro late-1990s theme-park-tycoon feel: pixel fonts, beveled windows, grass and sky, isometric pixel-art coasters and parks, whimsical colors. Inspired by the genre without copying any game's assets or trademarks. Whimsy should never slow down logging a ride.

## Non-goals (current)

- Accounts, cloud sync, or social features (friends, sharing, feeds).
- Parks outside the United States.
- Ride stats such as height, speed, or manufacturer.

These are not rejected; they need owner approval before becoming commitments. See `docs/open_questions.md`.
