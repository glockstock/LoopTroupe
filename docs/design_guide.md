# Loop Troupe Design Guide

Owner: `product_designer` (steward). Status as of 2026-10-02.

This is the canonical description of Loop Troupe's design language. The implementation lives in `css/style.css` (tokens and components) and the presentation code in `js/app.js` (templates, pixel sprites, isometric scenes). When you introduce or change a reusable convention, update this guide in the same change.

## 1. Principles

1. **A park you are building, not a website about parks.** The look evokes late-1990s theme-park simulation games: a grass world, sky panels, beveled parchment windows with blue title bars, pixel type, and isometric pixel dioramas. Evoke the genre with original art. Never copy a specific game's sprites, interface art, logos, or names, and never imply affiliation.
2. **Whimsy decorates; it never slows the rider down.** Logging a ride on a phone between rides is the hero task. Art sits around controls, never inside the tap path. No animation delays an action.
3. **Every ride is a color.** Each coaster gets one track color (by its position in its park) and one silhouette (from its id). The color shows on the diorama, the row stripe, the credit entry, and the modal swatch, so one coaster looks the same everywhere. Unridden coasters are gray "ghosts" that color in when ridden.
4. **Pixel honesty.** Geometry sits on whole pixels with hard edges. No blur, no rounded corners, no soft shadows, no smooth gradients on chrome. Shadows are hard offsets.
5. **Legibility beats nostalgia.** Pixel fonts are used at sizes where they read comfortably. Contrast, tap targets, and focus visibility are not traded for style.

## 2. Tokens

All shared values are CSS custom properties on `:root` in `css/style.css`. Reuse them; add a token rather than a one-off literal when a value repeats.

### Palette

| Role | Tokens | Use |
| --- | --- | --- |
| World | `--grass`, `--grass-dark`, `--grass-light` | Page background (pixel tuft tile), hills, ground |
| Sky | `--sky-top`, `--sky-bottom`, `--sky-ink` | Sky panels; `--sky-ink` for text on sky |
| Parchment | `--panel`, `--panel-alt`, `--panel-hover`, `--field` | Windows, alternating rows, hover, inputs and wells |
| Bevel | `--bevel-light`, `--bevel-dark`, `--edge` | Raised/inset borders; `--edge` is the ink outline around everything |
| Wood | `--wood`, `--wood-dark`, `--wood-light` | Top bar, footer, plaques (fractions, letter heads, captions, toasts) |
| Text | `--ink`, `--muted`, `--on-dark`, `--link` | Body, secondary, text on wood/ink, inline links on parchment |
| Window chrome | `--title`, `--title-hi`, `--title-lo` | Blue title bars |
| Accents | `--red`, `--orange`, `--yellow`, `--green`, `--blue`, `--purple` (+ `-dark`/`-hi`) | Status, stat cards, track colors |
| Action | `--green-btn` | Primary button fill (white text passes 4.5:1) |
| Ridden | `--ridden`, `--ridden-hover` | Background of ridden rows and visited passport stamps |
| Small yellow on wood | `--gold-light` | Links/labels on wood; plain `--yellow` on wood is for large text only |

Track colors (`TRACK_COLORS` in `app.js`): red, blue, orange, purple, yellow, teal, pink, green, assigned by the coaster's index within its park. Ghost (unridden) track is `#a39d90` with `#cfc8b8` supports.

### Type

| Token | Font | Size | Use |
| --- | --- | --- | --- |
| `--fs-h1` | Press Start 2P | clamp(18px, 3vw, 28px) | Page titles, hero (slightly larger), outlined white on sky |
| big numbers | Press Start 2P | 21 to 28px | Stat numbers, park fraction plaque, letter heads |
| `--fs-h2` | Pixelify Sans 700 | 20px | Window titles |
| `--fs-h3`, `.cname` | Pixelify Sans 600 | 18 to 20px | Card titles, coaster names |
| `--fs-ui` | Pixelify Sans 600/700 | 16px | Buttons, nav, field labels, tags |
| `--fs-body` | VT323 | 22px (21px on phones) | Body copy, ledes, inputs |
| `--fs-meta` | VT323 | 20px | Meta lines, reviews, legends |
| `--fs-small` | VT323 | 18px | Floor. Nothing in VT323 goes smaller. |

Rules:
- Press Start 2P is for display only: titles, numbers, single short words. Never paragraphs.
- VT323 is narrow with a small x-height. Treat 18px as the minimum and 22px as body.
- `font-variant-ligatures: none` is set globally. Pixelify Sans's "fi" ligature renders like an "A".
- The fallbacks keep sizes sane if the Google Fonts request fails (see Q-005).

### Spacing and sizing

- 4px grid: `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 24, `--s6` 32, `--s7` 48.
- `--tap` is 44px: the minimum for primary controls (buttons, inputs, ride toggles, stars). Secondary row buttons are at least 40px tall.
- Content column: `min(1120px, 100% - gutters)`; 12px gutters on phones.

### Bevels, edges, shadows

- **Raised** (buttons, windows, cards): `border-color: light dark dark light` (top/left lit).
- **Inset** (inputs, wells, progress tracks, pressed or selected state): the reverse, `dark light light dark`, plus a faint inner shadow.
- **Edge:** every window, card, and button gets a 2px `--edge` ring (`--ring`), which separates it from busy grass.
- **Drop shadow:** hard offset only. `--shadow` (4px) for buttons and plaques, `--shadow-lg` (6px) for windows. Hover lifts by translating -2px and growing the shadow. Press moves +2px and shrinks it.
- Border radius is always 0.

## 3. Surfaces and components

| Component | Class | Notes |
| --- | --- | --- |
| Window | `.window` + `.window-bar` + `.window-body` | Parchment, bevel, ink ring, hard shadow. The title bar is solid `--title` with a 2px highlight. A right-side slot (`.bar-meta`, `.bar-link`) holds counts or "All credits →". Use for any grouped content section. |
| Sky panel | `.sky` | Sky gradient with tiled pixel hills along the bottom and drifting clouds. Used for the hero, page heads (`.page-head`), and the park head (`.park-head`). Text on sky uses white outlined h1 and `--sky-ink` body. |
| Plaque | wood fill + ink border | Short labels on the world: park fraction, letter heads, scene caption, credit numbers (ink variant), toasts, back link (ink). |
| List window | `.window-list` | One window holding rows separated by 2px grooves. Never float each row as its own card. |
| Coaster row | `.coaster-row` | Ride toggle, name and meta, pixel stars, review snippet, action button. States: default parchment; hover `--panel-hover`; ridden `--ridden` with a 6px stripe in the coaster's track color and a green checked toggle. The unridden toggle shows a faint check as a hint. |
| Credit entry | `.credit-entry` | Like a row with an ink plaque number and Edit/Remove. Rows alternate `--panel`/`--panel-alt`. |
| Park card | `.park-card` | Sky-and-grass art strip with up to three coaster islands (ridden first), name, state tag, city, then "n / N ridden" and percent above a meter. States: `.visited` (green count), `.complete` (yellow meter and "Complete!" ribbon), `.defunct` (desaturated art and badge). Phones use a horizontal layout with art on the left. |
| Stat card | `.stat-card.s-{red,blue,green,gold}` | 6px colored top border, pixel icon in an inset well, Press Start number, VT323 label. |
| Buttons | `.btn`, `.btn-primary`, `.btn-danger`, `.btn-small`, `.icon-btn` | Pixelify 700. Primary is green, destructive is red, default is parchment. One primary per view or dialog. |
| Toggle button | `.control-btn` + `.tick` | Pressed state uses inset bevel, `--ridden` fill and a green tick; it exposes `aria-pressed`. |
| Nav | `.nav a` | Parchment tabs. Current page is yellow, pressed in, with `aria-current="page"`. The credit count badge is red. |
| Tags and badges | `.state-tag`, `.badge-defunct` | State tag is an ink chip. Badges are uppercase Pixelify with a 2px border. |
| Progress | `.progress-bar` (large), `.meter` (small) | Inset dark track with striped green fill and a top highlight; yellow when complete. Put labels beside the bar, never inside it. Stepped width transition. |
| Stars | `.row-stars` / `.px-star` | Pixel star symbol (`#px-star`), gold with a hard gold-ink shadow; off stars are 20% ink. Groups carry `role="img"` and "Rated n out of 5". |
| Passport | `.passport-cell` | Parchment stamp. `.some` turns light green, `.done` is a solid green stamp. A bottom fill bar shows the fraction. |
| Dialog | `.modal` | A window with a sticky title bar and close button. Stars are 48px pressable tiles. Date and count share a row. Actions: Remove (danger) left, Cancel and the primary on the right. On phones it docks to the bottom, with the primary full width on top. |
| Empty state | `.empty-state.window` | A gray (unridden) coaster island illustration, one line of copy, and at most one primary action. |
| Toast | `.toast` | Wood plaque, bottom center, announced via `role="status"`. |

## 4. Pixel art and isometric scenes

### Grid and crispness
- Every SVG uses `shape-rendering="crispEdges"`. Coordinates are integers. Polygons use 2:1 slopes so edges stair-step cleanly.
- Isometric projection: one tile is 32×16px. Scene code steps in sub-units of 1/8 tile (2px across, 1px down) and in half or quarter tiles for placement, so every vertex lands on a whole pixel.
- Fixed-size art (cards, empty states, head art) renders at 1× or an integer multiple (2×). Dioramas fit their container, capped at 2× native width (`max-width: calc(var(--w) * 2)`). Fractional scaling there stays crisp (no smoothing) but pixels may be uneven by one device pixel; that is acceptable.

### Coaster sprites
- Six original silhouettes are generated procedurally by walking a track circuit over a 2×2-tile plot with a height profile: `woodie` (dense lattice supports, camelbacks), `looper` (vertical loop), `hyper` (tall lift and drop), `launch` (flat launch into a top hat), `junior` (low and compact), and `mouse` (switchback rows).
- A silhouette is chosen from name cues (for example "mouse", "kiddie", "junior") and otherwise from a stable hash of the coaster id. **It is decorative, not data.** It must not be presented as the ride's real type; ride stats are a product non-goal.
- Sprite parts take colors from CSS variables: `--tc` (track), `--tcd` (track shade), `--sup` (supports), `--car` and `--card` (train). Each sprite has a station roof in the track color and, when ridden, a cream train.
- Draw order uses the painter's algorithm by iso depth (u + v) inside each sprite and across a scene.

### Scenes (`isoScene`)
- Layout: one 2×2 plot per coaster in a near-square grid (at least 2×2), 1-tile footpaths between plots, a 1-tile margin with a tree line along the back edges and low hedges along the front, and an entrance gate on the front-right edge.
- Spare plots get seeded scenery (pond, grove, food stall with balloon, flower beds). Guests are 2×6px figures on paths. Everything random is seeded by the park id, so a park's map is stable across visits.
- The ground is a grass-checker diamond on a two-tone dirt slab (lit left face, shaded right face, green lip).
- Up to 24 coasters are drawn. More shows a "+N more" sign.
- Each coaster carries a `<title>` (name and "ridden") for hover. The scene `<svg>` has `role="img"` and a label summarizing progress.

### Performance rule
- Large repeated lists (park cards, empty states, page-head art) use **cached blob-URL `<img>` islands** (`islandSrc`), one per silhouette and color, rather than live `<use>` clones. Live `<use>` sprites are reserved for single dioramas. In testing, 298 cards with live sprites cost about 2s per search keystroke; images cost about 100ms.
- Keep small icons to a single `<path>` or a `<symbol>` reference. Do not repeat multi-rect inline SVGs across 1,000 rows.

### Scenery and icons
- Scenery (trees, pines, bushes, stall, flowers, balloon, gate) is front-facing pixel art anchored at its ground point.
- UI icons are 12×12 pixel symbols (`#ico-coaster`, `#ico-gate`, `#ico-flag`, `#ico-star`) drawn in `currentColor` plus fixed accents, and shown at 3× or 4×.
- The brand mark is a 16×14 pixel loop with a train, drawn at 2×.

## 5. Motion

- Motion is ambient or confirms feedback. It never blocks or delays an action.
- Ambient: pixel clouds drift slowly (80 to 150s) across sky panels, behind the content.
- Feedback: buttons press 2px. Cards lift 2px on hover (`steps(2)`). Progress fills step with `steps(10)`. Toasts step in and out with `steps(3)`.
- Prefer `steps()` timing over smooth easing. Movement snaps like sprite animation.
- `prefers-reduced-motion: reduce` stops the clouds (parked in fixed positions), removes transitions and animations, and turns off smooth scrolling.

## 6. Responsive behavior

- Breakpoints: 960px (hero becomes two columns with copy left and diorama right), 760px (page heads show decorative coaster art on the right), 640px (phone layout), 360px (smallest phones).
- Phone layout: centered brand above a 4-up nav row; full-width CTAs; stat cards in a 2×2 grid; one-column park cards in a compact horizontal format; toolbars wrap with full-width search; coaster rows keep toggle, info, and action on one line with tighter gaps; credit actions become a full-width pair; the dialog docks to the bottom.
- There must be no horizontal page overflow at 320px or 390px. Long names wrap at word boundaries (`overflow-wrap: break-word`, `anywhere` only for h1).

## 7. Accessibility checklist

Run on every UI change (desktop 1360px, phones 390px and 320px):

- **Contrast:** body and meta text at least 4.5:1 (ink on parchment 10.8, muted on parchment 5.9, muted on panel-alt 5.1, white on title bar 5.7, white on primary button 4.9). Plain yellow on wood (3.65) is only for large display type; use `--gold-light` for small text on wood. Stat numbers in red or blue are large display type (3:1 or better).
- **Focus:** one global `:focus-visible` style, a yellow outline wrapped in ink inside and out, visible on grass, sky, wood, parchment, and yellow. Never remove it without replacing it.
- **Keyboard:** the skip link comes first. The dialog takes focus on open, traps Tab, closes on Escape or the close button, and returns focus to the opener.
- **Semantics:** nav has `aria-current`. Toggles have `aria-pressed`. Icon-like row buttons name their coaster ("Mark Blue Streak as ridden"). Stars and progress bars expose values. Decorative SVG and images use `aria-hidden` or empty `alt`.
- **Targets:** at least 44px for primary controls and at least 40px for secondary row actions on phones.
- **Escaping:** all user text (reviews) goes through `esc()` before rendering, including into `<title>` and `aria-label`.
- **Verify by rendering,** not from code. Check fonts actually loaded with `document.fonts` entries whose `status` is `loaded`. `document.fonts.check()` returns true when no face is registered at all, so it gives false positives.
