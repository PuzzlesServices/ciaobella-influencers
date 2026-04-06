# Crown Search — Project Context

## Overview

**Crown Search** is an internal influencer discovery dashboard for the brand **Monisha Melwani Fine Jewelry** (@monishamelwanifinejewelry, Miami FL). It allows the brand to find, score, and manage Instagram influencers using Apify for scraping and Gemini AI for match scoring.

---

## Client

| Field | Value |
|---|---|
| Brand | Monisha Melwani Fine Jewelry |
| Niche | Fine jewelry, natural & lab-grown diamonds, everyday luxury |
| Location | Miami, FL — South Miami showroom |
| Target audience | Women 25–45, mid-to-high income, USA |
| Website | https://monishamelwani.com |
| Instagram | @monishamelwanifinejewelry (~10K followers) |

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 18 |
| Language | TypeScript |
| Styles | Tailwind CSS v3 + CSS variables |
| Components | shadcn/ui (Radix UI primitives) |
| Server state | TanStack React Query v5 |
| Icons | Lucide React |
| Notifications | Sonner + Radix Toast |
| Charts | Recharts |
| AI (scoring) | Google Gemini (`gemini-2.5-flash-lite`) |
| AI (hashtag analysis) | Google Gemini (`gemini-2.5-flash-lite`) |
| Scraping | Apify (`instagram-hashtag-scraper` + `instagram-profile-scraper`) |
| HTTP client | Axios (server-side) |
| Database | Supabase (PostgreSQL) |
| DB client | `@supabase/supabase-js` |

---

## Design System

| Token | Value | Usage |
|---|---|---|
| `--background` | `#F9F7F1` (warm cream) | General background |
| `--primary` | `#842B29` (burgundy red) | CTAs, logo, active states |
| `--match-high` | green `142 71% 45%` | Score ≥ 80 |
| `--match-medium` | orange `38 92% 50%` | Score 50–79 |
| `--match-low` | red `0 84% 60%` | Score < 50 |

Font: **Inter** (Google Fonts, weights 300–700)

Logo: `/public/logo-monisha.webp` — displayed at 100px wide, centered in sidebar header.

---

## Project Structure

```
crown-search/
├── app/
│   ├── api/
│   │   ├── search/route.ts             ← POST /api/search
│   │   └── analyze-hashtags/route.ts   ← POST /api/analyze-hashtags
│   ├── globals.css                     ← CSS variables + Tailwind
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx                        ← re-exports src/pages/Index.tsx
├── src/
│   ├── components/
│   │   ├── CampaignSidebar.tsx         ← Left nav sidebar with logo
│   │   ├── HashtagAnalysisPanel.tsx    ← AI analysis results panel
│   │   ├── InfluencerCard.tsx          ← Result card with View Profile button
│   │   ├── MatchRing.tsx               ← SVG score ring
│   │   ├── Providers.tsx               ← QueryClient + TooltipProvider
│   │   └── ui/                         ← shadcn/ui components
│   ├── hooks/
│   │   ├── useSearch.ts                ← TanStack mutation → POST /api/search
│   │   └── useHashtagAnalysis.ts       ← TanStack mutation → POST /api/analyze-hashtags
│   ├── lib/
│   │   ├── supabase.ts                 ← Supabase clients (public + admin)
│   │   └── utils.ts                    ← cn() helper
│   ├── pages/
│   │   └── Index.tsx                   ← Main page ('use client')
│   └── server/                         ← Server-only logic
│       ├── types.ts                    ← HashtagPost, InstagramProfile, ScoredInfluencer
│       ├── db/
│       │   └── influencers.ts          ← cacheInfluencer, saveInfluencerToCampaign, getTopSavedInfluencers
│       ├── filters/
│       │   ├── preFilter.ts            ← Discards shops/brands before Profile Scraper
│       │   └── postFilter.ts           ← Filters by followers, bio, account type
│       └── services/
│           ├── apify.ts                ← Hashtag Scraper + Profile Scraper
│           ├── gemini.ts               ← Match score 0-100
│           └── hashtagAnalyzer.ts      ← Hashtag strategy analysis
├── supabase/
│   └── schema.sql                      ← Full DB schema, RLS policies, trigger
├── .env.local
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Data Flow

```
Index.tsx (client)
  ├─ useHashtagAnalysis  →  POST /api/analyze-hashtags
  │                             └─ hashtagAnalyzer.ts  [Gemini — strategy analysis]
  │
  └─ useSearch           →  POST /api/search
                               ├─ apify.ts → scrapeHashtags()    [Apify Hashtag Scraper]
                               ├─ preFilter.ts                    [local, free]
                               ├─ apify.ts → scrapeProfiles()    [Apify Profile Scraper]
                               ├─ postFilter.ts                   [local, free]
                               ├─ gemini.ts → scoreInfluencer()  [Gemini, 4s delay]
                               └─ db/influencers.ts → cacheInfluencer()  [Supabase upsert]
```

---

## Environment Variables

```
# Scraping
APIFY_TOKEN=...

# AI
GOOGLE_API_KEY=...          # Google AI Studio key

# Database
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Server-only, bypasses RLS
```

---

## API Endpoints

### POST /api/search

**Request:**
```json
{ "hashtags": ["miamiinfluencer"], "maxResults": 10 }
```

**Response:**
```json
{
  "influencers": [ScoredInfluencer],
  "stats": {
    "hashtagPostsFound": 10,
    "afterPreFilter": 6,
    "afterProfileFilter": 5,
    "final": 5
  }
}
```

`maxResults` defaults to 10. With multiple hashtags the limit is split evenly.

### POST /api/analyze-hashtags

**Request:**
```json
{ "hashtags": ["miamiinfluencer", "miamiluxury"] }
```

**Response:**
```json
{
  "analysis": "Strategic explanation...",
  "warnings": ["#miamiluxury: likely dominated by brand accounts"],
  "suggestions": ["miamifashionblogger", "miamicontentcreator"],
  "efficiency_score": 85
}
```

---

## Database — Supabase

Schema file: `supabase/schema.sql`

### `influencers` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `username` | text UNIQUE | Instagram handle, conflict key |
| `full_name` | text | |
| `profile_pic` | text | URL |
| `bio` | text | |
| `followers_count` | integer | |
| `engagement_rate` | numeric(5,2) | `(likes + comments) / followers × 100` from one post |
| `match_score` | integer 0–100 | Gemini score |
| `ai_category` | text | e.g. "Lifestyle Miami" |
| `ai_reason` | text | One-line Gemini explanation |
| `campaign_status` | enum | `Lead` \| `Contacted` \| `Gifted` \| `Rejected` — default `Lead` |
| `notes` | text | Free text, client-editable |
| `is_saved` | boolean | `false` = cache only, `true` = client saved |
| `created_at` | timestamptz | |
| `last_updated` | timestamptz | Auto-updated by trigger on every UPDATE |

### Cache vs. Leads Strategy

- **Cache** (`is_saved = false`): every scraped profile is stored. Prevents re-spending Apify/Gemini credits if the same profile appears again.
- **Lead** (`is_saved = true`): only profiles the client explicitly saves appear in the campaign view.
- `cacheInfluencer()` updates metrics/AI fields on conflict but **never overwrites** `is_saved`, `campaign_status`, or `notes`.

### DB Functions (`src/server/db/influencers.ts`)

| Function | Description |
|---|---|
| `cacheInfluencer(data)` | Upserts scraper data. On conflict: updates metrics only, preserves CRM fields. |
| `saveInfluencerToCampaign(username)` | Sets `is_saved = true` for a profile. |
| `getTopSavedInfluencers()` | Returns all `is_saved = true` rows, ordered by `match_score DESC`. |

### Supabase Clients (`src/lib/supabase.ts`)

- `supabase` — public anon client for Client Components (respects RLS)
- `getAdminClient()` — service role client for server-side only (bypasses RLS, never expose to browser)

---

## Engagement Rate — Important Caveat

Calculated in `app/api/search/route.ts` as:
```
(likesCount + commentsCount) / followersCount × 100
```
This uses **a single post** (the hashtag post that surfaced the user). It's an approximation, not the profile average.

---

## Key Technical Decisions

- **Gemini scoring is sequential** with 4s delay between calls (respects 15 RPM free tier limit)
- **Apify uses `waitForFinish=120`** with automatic polling fallback for runs > 2 min
- **`maxDuration = 300`** on the API route (for Railway / Vercel Pro)
- **`engagementRate` can be null** from Apify → handled with `?? 0` before `.toFixed()`
- **Supabase admin client** uses service role key, instantiated per-request (not a singleton) to avoid cross-request state issues in Next.js

---

## Recommended Hashtags for Monisha

### High Efficiency (use these)
```
miamiinfluencer
miamicontentcreator
miamiblogger
miamilifestyleblogger
miamifashionblogger
southfloridainfluencer
miamimomblogger
```

### Medium Efficiency (use with caution — noise)
```
miamilifestyle     → broad, international noise
miamiluxury        → attracts brand accounts
ootd               → heavy international noise
```

### Low Efficiency (avoid — returns stores)
```
jewelry, finejewelry, diamonds, labgrowndiamonds,
stackingrings, jewelsofinstagram, diamondring
```

---

## Promising Profiles Found in Tests

```
@imkianajordyn       — "kiana jordyn miami influencer"
@__dianaxoo          — "Dee's World, Miami Content Creator"
@aya_from_miami      — personal Miami profile
@kissandmakeupbysteph — makeup artist, works with @auroraculpo
@calista.sorelli     — lifestyle/fitness blogger
```

---

## Pending / Next Steps

1. **Wire `cacheInfluencer` into `/api/search`** — currently the DB functions exist but aren't called in the search route yet
2. **"Save" button on InfluencerCard** — calls `saveInfluencerToCampaign(username)`
3. **Saved influencers view** — separate page/tab using `getTopSavedInfluencers()`
4. **Update `campaign_status` and `notes`** — CRM editing UI
5. **Sidebar nav wired up** — nav items are placeholder buttons, not yet routed
6. **Profile cache** — check Supabase before calling Apify to avoid re-scraping known profiles
7. **Gemini quota** — free tier has rate limits; monitor and handle `429` errors gracefully

---

## Commands

```bash
npm install              # install dependencies
npm install @supabase/supabase-js   # if not yet installed
npm run dev              # http://localhost:3000
npm run build
npm run start
npm run lint
```
