# 🎢 Loop Troupe

Goodreads for roller coasters: a **credit tracker** for enthusiasts. Browse every roller coaster in
every park in America, check off the ones you've ridden, rate them, and write ride
reviews — all in a fast, beautiful static site.

**The database:** 298 American parks · 1,000+ coasters · 45 states, including defunct
parks for your legacy credits.

## Features

- **Parks browser** — search and filter every US park by name, city, or state; sort by
  size or your completion; optionally include defunct parks.
- **Every coaster A–Z** — one searchable index of every coaster in the country.
- **One-tap credits** — mark a coaster ridden instantly, or log the full story: first
  ride date, times ridden, a 5-star rating, and a written review.
- **State passport** — watch states light up as you conquer their coasters.
- **My Credits** — your full riding résumé, newest first, with edit/remove.
- **Private by design** — your ride log lives in your browser's `localStorage`.
  Export a JSON backup any time and import it on another device.

## Hosting on GitHub Pages

Live at **https://glockstock.github.io/LoopTroupe/**. The site is 100% static (no build
step): every push to `main` runs `.github/workflows/deploy.yml`, which publishes the
repository to the `gh-pages` branch that GitHub Pages serves. A push to `main` is a release.

## Development

No tooling required — it's plain HTML/CSS/JS:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

```
index.html          app shell
css/style.css       design system (tokens + components)
js/data.js          the coaster database (parks → coasters)
js/app.js           SPA logic: routing, views, ride log, pixel scenes, backup
docs/               product spec, technical spec, design guide, open questions
.codex/agents/      specialist agent fleet (Codex)
.claude/agents/     the same specialists for Claude Code
AGENTS.md           who owns what, and how agents route work
```

Start with `AGENTS.md`, then `docs/spec.md` (what we're building), `docs/tech_spec.md`
(how it's built), and `docs/design_guide.md` (the retro design language).

## Data notes

The park/coaster list was curated from a September 2024 public coaster-database
snapshot, filtered to US parks, with notable 2025 additions (e.g. Universal Epic
Universe) added by hand. Spotted a missing or misplaced coaster? Edit `js/data.js` —
each park is a small JSON object — and open a PR. Never change an existing coaster
`id`: riders' saved credits are stored under it.
