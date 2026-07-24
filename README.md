# 🎢 Coaster Credits

A roller coaster **credit tracker** for enthusiasts. Browse every roller coaster in
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

The site is 100% static (no build step) and deploys automatically:

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**
   (one-time step).
3. The included workflow (`.github/workflows/deploy.yml`) publishes the site on every
   push to `main`.

Your site will be live at `https://<username>.github.io/LoopTroupe/`.

## Development

No tooling required — it's plain HTML/CSS/JS:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

```
index.html          app shell
css/style.css       design system
js/data.js          the coaster database (parks → coasters)
js/app.js           SPA logic: routing, views, ride log, backup
```

## Data notes

The park/coaster list was curated from a September 2024 public coaster-database
snapshot, filtered to US parks, with notable 2025 additions (e.g. Universal Epic
Universe) added by hand. Spotted a missing or misplaced coaster? Edit `js/data.js` —
each park is a small JSON object — and open a PR.
