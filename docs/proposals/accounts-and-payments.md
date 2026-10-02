# Proposal: Accounts, Backend, and Payments

Author: `engineering_manager`. Date: 2026-10-02. Status: **proposal for owner approval. Nothing here is built or approved**, and `docs/tech_spec.md` is unchanged until you decide.

This is the escalation AGENTS.md requires for a big change: adding a backend, accounts, third-party services, payments, and a hosting change. It is also the **request for your approval for ride data to leave the browser** for the first time.

---

## Recommendation (read this first)

1. **Phase 1 (demand test): no infrastructure.** Sell one guide (e.g., Cedar Point) as a PDF through a merchant-of-record checkout (Lemon Squeezy) linked from the site. No accounts, no backend, and no ride data leaves anyone's browser. Cost: $0/month plus about 5% + 50¢ per sale.
2. **Phase 2 (accounts + cloud credits + profiles/reviews): Neon (Postgres) + Neon's managed auth + Neon Data API with row-level security.** Add a few server functions on **Cloudflare Workers**, and move hosting from GitHub Pages to Cloudflare when paid guides go live in the app.
   - Why Neon: you already know it, it is plain Postgres with little lock-in, it costs $0 to about $40/month up to 10,000 monthly users, and its user table lives in our own database.
3. **This recommendation depends on a 1–2 day spike** (a short technical experiment with no user-facing change). The spike must show that Neon's auth works from our plain-JS, no-build page, including Safari's cookie restrictions. **If the spike fails, use Supabase**, a close second that explicitly supports no-build browser use. Both are Postgres, so the data model and security policies carry over.
4. **The frontend stays no-build plain JS.** The server functions need one deploy tool (`wrangler`). That is a small, server-side-only tooling addition, not a frontend build step.
5. **Signed-out and offline use keeps working exactly as today.** The local copy stays the primary copy on each device. The cloud is a sync target, never the only copy.

**Your decisions are listed in section 9.**

---

## 1. Requirements derived from the vision

| # | Requirement | Phase |
| --- | --- | --- |
| R1 | Sign up / sign in (social login + email); sign out; session survives reloads | 2 |
| R2 | Credits sync across devices; same fields as today (date, count, rating, review) | 2 |
| R3 | Existing local credits move into the account with zero loss | 2 |
| R4 | App fully usable signed-out and offline | 2 |
| R5 | Public profile (opt-in) and public reviews (opt-in per review) | 2 |
| R6 | Paid guides readable only by people entitled to them, checked on a server | 1 (weak), 2–3 (real) |
| R7 | Payment → entitlement automatically (webhook), refunds revoke | 2–3 |
| R8 | User-generated tips with moderation (queue, report, hide) | 3 |
| R9 | Account deletion (self-serve) and full data export (JSON, importable signed-out) | 2 |
| R10 | Abuse controls: rate limits, bot check on sign-up, escaping (already done) | 2 |
| R11 | Coaster IDs stay a durable contract across browser and server | 2 |

## 2. The key constraint

**A static GitHub Pages site cannot protect paid content.** Every file it serves can be downloaded by anyone who requests the URL. Client-side passwords, obfuscation, or "hidden" links do not change that.

It is worse than that here. **The `glockstock/looptroupe` repository is public** (checked 2026-10-02), so a guide committed to the repo is public on GitHub before it is even deployed.

What this means for hosting:

- **Paid guide content must never be in this repository.** It must live in a database or private storage and be served by a server function that checks "is this user signed in, and do they own this guide?" on every request.
- GitHub Pages has no server functions, so gated guides need a second host for those functions at minimum.
- GitHub's Pages terms say Pages is "not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions" ([GitHub Docs, Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), checked 2026-10-02 via the docs source on GitHub).
  - A free credits app with one "buy" link is arguably not *primarily* commercial, so Phase 1 is low risk.
  - A paywalled guide product is a closer call, so I recommend moving to Cloudflare when guides go live in the app.
- Cloudflare serves static files free and without limit, allows commercial use, and runs our functions on the same domain. A shared domain avoids most cookie and CORS problems.
- **Server gating stops casual access and link sharing, but not a paying customer copying text.** No web product can prevent that. It is normal and acceptable.

## 3. Options

All three options keep the no-build frontend: the vendor client loads as a pinned ES module from a CDN, or we call the REST APIs with `fetch()`.

| | **A. Neon + Neon Auth + Cloudflare** (recommended) | **B. Supabase + Cloudflare hosting** | **C. Firebase** |
| --- | --- | --- | --- |
| Auth | Managed Better Auth (open-source library). Users and sessions stored in *our* Postgres. Free ≤60k MAU; Launch ≤1M MAU | Supabase Auth. Free 50k MAU; Pro 100k then $0.00325/MAU | Firebase Auth. Free ≤50k MAU, then ~$0.0055/MAU* |
| Database | Postgres (serverless, scales to zero) | Postgres | Firestore (NoSQL documents) |
| Row-level security | Yes: Postgres RLS via Data API, `auth.user_id()` from the sign-in token | Yes: Postgres RLS, `auth.uid()` | Security Rules (own language) |
| Client data access | Data API (PostgREST-style REST; plain `fetch` works) | PostgREST REST / `supabase-js` (documented CDN ESM use) | Firebase SDK (CDN ESM) |
| Server functions | Cloudflare Workers (or the new Neon Functions, Node 24) | Supabase Edge Functions (500k free; 2M on Pro) | Cloud Functions: **requires paid Blaze plan** |
| Private content storage | Postgres rows or object storage (Neon Object Storage / Cloudflare R2) | Storage with private buckets and signed URLs | Cloud Storage + rules |
| Hosting | Cloudflare (static assets free, same domain as Workers) | Cloudflare (Supabase does not host sites) | Firebase Hosting |
| Local dev | Static server + `wrangler dev`. **No local DB emulator**: dev runs against a cloud Neon branch (auth branches with it) | **Best**: `supabase start` runs the whole stack locally (needs Docker) | Emulator Suite (Java + Node) |
| Lock-in | **Low**: plain Postgres, open-source auth library, user table in our DB | Low–moderate: open-source, self-hostable, Postgres | **High**: proprietary data model and rules |
| No-build fit | **Unproven**: SDK docs are React/Next.js-first; sessions may rely on cross-site cookies. **Spike required** | Proven: CDN ESM documented; session token kept in the page, no cross-site cookies | Good |
| Owner familiarity | **Yes** (Ouratide) | No | No |
| Fit for reviews, park completion, averages | Strong (SQL) | Strong (SQL) | Weak: aggregates and feeds need denormalizing, and reads are billed |

\*Secondary source; see Sources.

**Why A over B:** you already run Neon. Auth data sits in our own tables, so leaving is easier. It is cheaper at low scale (no $25 floor) and it does not pause idle projects. **B wins** if the spike shows Neon auth is awkward without a bundler, or if a local all-in-one dev stack matters more than familiarity.

**Why not C:** Firestore is a poor fit for relational data (credits × coasters × parks, ratings averages). It has the highest lock-in, server functions require the paid plan anyway, and nobody here knows it.

**Considered and set aside:** Vercel for hosting and functions. Vercel's free Hobby plan prohibits commercial use, and Pro is $20/seat/month. Cloudflare costs $0–5 for the same job.

### Sketch of the server data model (for evaluation, not approval)

- `coasters(id PK)`: seeded from `js/data.js` IDs by a CI step. The step only adds IDs; it never deletes or renames.
- `profiles(user_id PK, handle UNIQUE, is_public bool DEFAULT false)`
- `credits(user_id, coaster_id FK, first_ridden, ride_count, rating, review, review_public bool DEFAULT false, logged_at, updated_at, deleted_at)`, primary key `(user_id, coaster_id)`
- `entitlements(user_id, product_id, provider, provider_ref, granted_at, expires_at NULL, revoked_at NULL)`: written only by the payment webhook.
- `guides(id, park_id, version, body)`: no client access at all. Only the guide Worker reads it.
- Phase 3: `tips(status pending|approved|hidden)`, `reports`.

## 4. Payments

| | **Stripe direct** (Checkout + Billing + Tax) | **Merchant of record**: Lemon Squeezy / Paddle / Stripe Managed Payments |
| --- | --- | --- |
| Who is the legal seller | You | The provider |
| Sales tax | Stripe Tax *calculates and collects* (+0.5%). **You register and file** in states where you owe tax | Provider collects, files, and remits |
| Fees (US card) | 2.9% + 30¢; +0.7% Billing for subscriptions; +0.5% Tax | LS and Paddle ~5% + 50¢ (LS adds ~1.5% international); Stripe Managed Payments 2.9% + 30¢ + 3.5% |
| On a $5 guide (estimate) | ~$0.47 (9%) | ~$0.75 (15%) |
| On $30/yr subscription (estimate) | ~$1.53 (5%) | ~$2.00 (7%) |
| Delivers files itself | No | Lemon Squeezy: yes (useful for Phase 1) |
| Notes | Most control; lowest fees | Lemon Squeezy is Stripe-owned and converging on Stripe Managed Payments; confirm product continuity. **Confirm Paddle accepts guide/info-product content.** |

Tax note: this is a summary of the mechanics, not tax advice. Whether digital guides are taxable varies by state.

**Engineering recommendation:** use a merchant of record while volume is small. Fees are higher, but it removes your sales-tax registration and filing duties, which is the expensive part for a solo owner. Keep `entitlements` provider-agnostic so we can switch to Stripe direct later. Integration is the same shape either way: hosted checkout page → signed webhook → Worker writes `entitlements`. No card data ever touches our code.

Pricing is `product_manager`'s call. Here is what each model means for the system:

| | Per-guide purchase | Subscription (all guides) |
| --- | --- | --- |
| Entitlement | Permanent row per guide (`expires_at` null) | One row with `expires_at`, extended on each renewal webhook |
| Webhooks to handle | Paid, refunded | Paid, renewed, payment failed / past due, canceled, refunded |
| Extra surface | None | Customer portal link (provider-hosted); grace period rules |
| Fee drag | High on low prices (the fixed 30–50¢ dominates) | Lower per dollar |
| Open product questions | Do buyers get guide updates? Bundles? | What happens to offline copies after cancel? |

## 5. Phase 1: no-infrastructure demand test

**How it works:**

1. Write the Cedar Point guide as a PDF. Keep it **outside this repo**.
2. Create a Lemon Squeezy product that hosts the file, takes payment, emails the download, and handles sales tax.
3. Add a "Get the Cedar Point guide" button on the Cedar Point park page. It links out to the Lemon Squeezy checkout.
4. Read demand from the Lemon Squeezy dashboard (sales, refunds). Do not add on-site analytics without separate approval, per AGENTS.md.

**What it protects:** almost nothing. A buyer can forward the PDF or the download email. That is fine for a test because:

- the question is "will people pay?", not "can we stop sharing";
- one leaked guide costs little;
- no accounts, passwords, or ride data are involved;
- it is fully reversible (remove the link, refund buyers).

**Alternative:** a Stripe Payment Link is cheaper per sale. But it does not deliver the file (you would email it by hand or redirect buyers to an unguarded URL), and you would own the sales-tax question.

**Cost:** $0 fixed. About $0.75 per $5 sale (estimate).

## 6. Migration of existing credits

### Facts about today's code (observed in `js/app.js`)

- Storage is `{ version: 1, rides: { [coasterId]: { date, rating, review, count, loggedAt } } }`.
- **There is no "last updated" time.** `loggedAt` is kept unchanged when a ride is edited.
- **Deletes are hard deletes** (`delete rides[id]`). Nothing records that a deletion happened.
- Import overwrites same-ID entries and skips unknown IDs.

Syncing two copies needs "which edit is newer" and "this was deleted". So cloud sync requires a **versioned local schema change (v1 → v2)**, which is itself a contract change that needs your approval.

### Proposed local v2

Add `updatedAt` to each ride and a `deleted: { [coasterId]: deletedAt }` map, plus `accountId` and `lastSyncAt`.

- **Migration:** v1 → v2 sets `updatedAt = loggedAt`. It **leaves `coaster-credits.v1` untouched** as a rollback copy for at least one release cycle. Signed-out riders get the same migration.
- **Backup compatibility:** backups export v2, and import keeps accepting v1 files.

### First sign-in on a device

1. Before anything uploads, offer "Download a backup first" and save an automatic local snapshot.
2. **Cloud account is empty:** upload every local ride whose coaster ID exists on the server. Rides with unknown IDs **stay local** and are listed to the rider. They are never dropped.
3. **Cloud already has data** (second device): merge **per coaster**, never "replace all":

| Field | Rule |
| --- | --- |
| Credit exists on one side only | Keep it (union) |
| `date` (first ridden) | Earliest non-empty |
| `count` | Larger value. Not the sum: the same rides logged on two devices would double-count |
| `rating`, `review` | From the side with the newer `updatedAt` |
| Two different non-empty reviews | Keep the newer one, and show the older one to the rider in a "review conflicts" list to restore if wanted |
| Deletion vs. edit | The deletion wins only if it is newer than the other side's edit |

On the very first merge there is no deletion history from v1. A credit removed on one device but present on another therefore comes back. That is a deliberate bias toward never losing a credit; the rider can remove it again.

### Ongoing sync

- Every edit writes locally first, then queues for upload.
- Sync runs on load, on reconnect, and when the tab becomes visible.
- Same merge rules as above. The server sets `updated_at` on its side, so a wrong device clock is less of a problem.

### Signed-out, offline, and sign-out

- **Signed-out:** identical to today. Nothing is transmitted.
- **Offline while signed in:** works fully; changes queue until the device reconnects.
- **Sign-out:** asks "Keep a copy of your credits on this device?" (default yes; choose no on shared computers).

### Coaster-ID contract

- The server's `coasters` table only grows: CI adds new IDs from `js/data.js` on deploy and never deletes or renames.
- A server credit must reference a known ID (foreign key).
- Any future ID change needs:
  - an `engineering_manager`-approved migration that runs on **both** the server and the browser;
  - a `coaster_id_aliases` table so old clients still sync.
- This extends the existing rule in AGENTS.md. It does not change it.

## 7. Privacy and security

**Approval requested:** signed-in riders' credits (dates, counts, ratings, reviews) are stored on our servers (Neon, region `aws-us-east-*`).

| Topic | Proposal |
| --- | --- |
| Default visibility | Profiles **private** by default. Reviews **private** by default with a per-review "make public" toggle. Signing in alone publishes nothing |
| Data collected | Email (or social-login ID), chosen handle, credits. No real name required. No analytics or tracking |
| Row-level security | On for every table; deny by default. Riders read and write only their own rows. A `public_reviews` view exposes only public reviews from public profiles (handle, coaster, rating, text). Entitlements are writable only by the webhook's server key. Guides are not exposed to clients at all |
| Secrets | Database admin key, payment webhook secret, and API keys live only in Worker secrets (`wrangler secret`), **never in this public repo**. The browser holds only a public key that is safe *because* of row-level security. Turn on GitHub secret scanning and push protection |
| Payment webhooks | Verify the signature; process each event once (no double-grants) |
| Spam and abuse | Bot check on sign-up (Cloudflare Turnstile, free); per-user write rate limits; review length cap; continue escaping all user text (`esc()`); "report" on public reviews; an admin "hide" flag |
| Phase 3 tips | Every tip waits in a queue for approval before it is shown; later, trusted contributors skip the queue |
| Deletion | Self-serve "Delete account" hard-deletes the profile, credits, reviews, and sessions immediately (backups age out within the provider's restore window, 7 days on Neon Launch). The payment provider keeps order records for tax law; we delete our entitlement rows |
| Export | "Download my data" returns JSON in the backup format, importable while signed out |
| Legal prerequisites (before Phase 2 launch) | Privacy policy and terms; minimum age 13; register a DMCA agent if user content is public. These are owner and legal items, flagged here only |

## 8. Costs

All monthly. These are **estimates**.

**Assumptions:**

- "Users" means signed-in monthly active users.
- About 200 credits per user and ~0.5 KB per credit, so ~1 GB at 10k users including indexes.
- About 50 API calls per user per month.
- The database runs at 0.25–0.5 CU while awake and scales to zero when idle.
- Payment fees are per sale and excluded below (see section 4).

| Stack | ~100 users | ~1,000 users | ~10,000 users |
| --- | --- | --- | --- |
| **A. Neon + Cloudflare** | **$0** (Neon Free: 100 CU-h, 1 GB, 60k MAU; Workers Free 100k req/day) | **~$5–20** (likely Neon Launch: ~75–150 CU-h × $0.106; storage <$0.10; Workers Paid $5 for headroom) | **~$25–45** (~180–365 CU-h × $0.106 ≈ $19–39; storage ~$0.35–0.70; Workers $5) |
| **B. Supabase + Cloudflare** | $0 on Free, but idle projects pause after 1 week and there are no backups, so **$25** for anything real | **$25** (Pro: 100k MAU, 8 GB, includes Micro compute) + $0–5 | **~$25–40** (Pro; may need a larger compute size) + $5 |

Both stacks also need:

- a custom domain, about $10–15/year (estimate; recommended for the hosting move);
- an email-sending service if the auth provider doesn't send sign-in emails (often free at this volume; **unverified for Neon auth**).

Phase 1 costs $0 fixed under either stack.

**Sources** (checked 2026-10-02). This environment's network policy **blocked direct access** to neon.com, supabase.com, firebase.google.com, stripe.com, lemonsqueezy.com, paddle.com, vercel.com, and developers.cloudflare.com. Where possible I read the vendors' own docs source published on GitHub instead.

- Primary, from the vendor's docs source:
  - Neon plans: [`neondatabase/website` content/docs/introduction/plans.md](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md) and free-plan FAQ. Free: 100 CU-h, 1 GB, 60k MAU, 5 GB transfer. Launch: $0.106/CU-h, $0.35/GB-mo, no minimum.
  - Neon Data API access control and Functions overview, same repo.
  - Supabase plans: [`supabase/supabase` packages/shared-data/plans.ts and pricing.ts](https://github.com/supabase/supabase/tree/master/packages/shared-data). Free: 50k MAU, 500 MB, pauses after 1 week, 2 projects. Pro: from $25, 100k MAU, 8 GB, 2M function calls.
  - Cloudflare Workers pricing: [`cloudflare/cloudflare-docs` workers/platform/pricing.mdx](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/pricing.mdx). Free 100k req/day; Paid $5 for 10M req; static asset requests free and unlimited.
  - GitHub Pages limits: [`github/docs`](https://github.com/github/docs/blob/main/content/pages/getting-started-with-github-pages/github-pages-limits.md).
- **Secondary** (search results, not vendor pages; verify before committing money):
  - Stripe 2.9% + 30¢, Billing 0.7%, Tax 0.5%;
  - Lemon Squeezy and Paddle ~5% + 50¢;
  - Stripe Managed Payments +3.5%;
  - Lemon Squeezy's Stripe ownership and migration toward Managed Payments;
  - Vercel Hobby non-commercial clause and Pro $20/seat;
  - Firebase Auth 50k MAU free, Cloud Functions require Blaze.

## 9. Risks, rollback, and decisions

### Risks

| Risk | Mitigation |
| --- | --- |
| Credits lost or duplicated during migration or sync | v1 key kept untouched; auto-snapshot before first sync; union-biased merge; `qa_engineer` test plan with real backup files before launch |
| Neon auth doesn't fit a no-build static page (cookies, Safari) | 1–2 day spike before any commitment; Supabase fallback |
| Operational burden: a backend means outages, backups, and on-call for a solo owner | Managed services only; app degrades to local-only when the cloud is down; nightly `pg_dump` to cheap storage beyond the provider's restore window |
| Paid content leaks | Accepted. Server gating plus per-user watermark (e.g., "Licensed to @handle") as a deterrent |
| Sales-tax exposure | Merchant of record |
| Vendor price or product changes (Neon Functions is new; Lemon Squeezy is merging into Stripe) | Postgres + open-source auth library keep the exit cheap; provider-agnostic entitlements |
| Scope creep before demand is proven | Phase 1 needs none of this |

### Rollback

- **Phase 1:** remove the link; refund through the provider.
- **Phase 2:** cloud sync sits behind a switch.
  - Turning it off returns the app to local-only. Every device still has its full local copy, so nothing is lost on the device.
  - Server data stays exportable via "Download my data".
- **Hosting move:** keep the GitHub Pages workflow working until Cloudflare is verified. The DNS switch is reversible.
- **Schema:** v1 stays readable, and import accepts v1 indefinitely.

### Decisions I need from you

1. **Phase 1:** approve selling one guide as a PDF via a Lemon Squeezy link from the site (no infrastructure)? *Recommend yes.*
2. **Ride data leaving the browser:** approve storing signed-in riders' credits on our servers, private by default? *Required for Phase 2.*
3. **Backend:** Neon + Neon auth (recommended, subject to the spike) or Supabase?
4. **Spike:** approve a 1–2 day technical spike (throwaway branch, no user-facing change) to validate Neon auth from plain JS?
5. **Local storage schema v1 → v2** (adds `updatedAt` and deletion records; keeps v1 as rollback): approve in principle?
6. **Hosting:** approve moving from GitHub Pages to Cloudflare, plus buying a custom domain, when paid guides go live in the app?
7. **Payments:** merchant of record (no tax filing, ~5% + 50¢) or Stripe direct (cheaper, you handle sales tax)?
8. **Tooling:** approve `wrangler` (Cloudflare's deploy CLI) for server functions only? The frontend stays no-build.

## 10. Open technical questions

For the primary agent to merge into `docs/open_questions.md` (IDs to be assigned there).

1. Does Neon's managed auth work from a plain-JS page with no bundler? Does it avoid relying on third-party cookies, which Safari blocks? (spike)
2. Is a custom domain required so the app, auth, and functions share a site for cookies?
3. Does Neon's managed auth send verification and magic-link emails itself, or do we need an email provider?
4. Where does guide content live (Postgres rows vs. object storage)? In what format (Markdown rendered on the server)?
5. Should purchased guides be readable offline? Any cached copy is copyable; is that acceptable?
6. `count` conflict rule: is "larger value" right, or do riders expect counts from two devices to add up? (product input)
7. Should `js/data.js` eventually be generated from the server `coasters` table, or stay the source of truth with CI seeding the server?
8. Backups beyond Neon's restore window: nightly `pg_dump` to R2, and how long to keep it?
9. Rate-limit values and where to enforce them (Worker vs. database)?
10. Which sign-in methods at launch (Google, Apple, email magic link)? Apple sign-in carries Apple developer costs. (product + design input)
11. Does Paddle accept guide/info-product sales, and what is the Lemon Squeezy → Stripe Managed Payments timeline?
