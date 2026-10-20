# PRD: TrendScope — Trending Social Video Finder

| | |
|---|---|
| **Status** | Draft v1 |
| **Owner** | huynhbathang40-creator |
| **Repo** | `huynhbathang40-creator/agents21` |
| **Deploy target** | Netlify (production from `main`) |
| **Data provider** | [Scrape Creators API](https://docs.scrapecreators.com) |
| **Last updated** | 2026-10-20 |

> "TrendScope" is a working name. Rename freely.

---

## 1. Problem

Creators, marketers, and curious people want to know which videos are taking off right now and what is working for a given topic. To find out today, you open TikTok, Instagram, and YouTube one at a time, scroll feeds tuned to your own account, and can't compare engagement side by side.

## 2. Product summary

TrendScope is a web app that does two things:

1. **Shows what's trending now** on TikTok, Instagram Reels, and YouTube Shorts.
2. **Searches by keyword or hashtag** across those platforms in one place.

It ranks the results by engagement. All data comes from the Scrape Creators REST API, called through Netlify Functions so the API key never reaches the browser.

## 3. Goals and non-goals

### Goals (v1)
- G1: Show a trending feed for each supported platform within 3 seconds when it's cached and 10 seconds when it isn't.
- G2: Search any keyword or hashtag on one or more platforms and see the results together.
- G3: Show results as uniform video cards that can be sorted.
- G4: Keep the Scrape Creators API key server-side at all times.
- G5: Keep credit spend in check with caching and request limits.
- G6: Deploy to Netlify automatically when code is pushed to `main`.

### Non-goals (v1)
- User accounts, logins, or saved searches stored on a server.
- Downloading or rehosting video files. Cards link out to the original post.
- Scheduled scraping or historical trend charts.
- Ads, ad libraries, TikTok Shop, or creator email lookup.
- A native mobile app. The web app will be responsive, though.

## 4. Target users

| Persona | Need |
|---|---|
| **Content creator** | "What formats and sounds are blowing up in my niche this week?" |
| **Social media marketer** | "Which videos about our product category are getting the most engagement?" |
| **Casual browser** | "Show me what's viral right now without an algorithm built around me." |

## 5. User stories

| ID | As a… | I want to… | So that… | Priority |
|---|---|---|---|---|
| US-1 | visitor | land on a page that already shows trending videos | I get value without typing anything | P0 |
| US-2 | visitor | switch between TikTok, Instagram, and YouTube tabs | I can see each platform's trends | P0 |
| US-3 | visitor | search a keyword or `#hashtag` | I find top videos on a topic | P0 |
| US-4 | visitor | choose which platforms a search covers | I control both scope and speed | P0 |
| US-5 | visitor | sort by views, likes, comments, engagement rate, or recency | I find the strongest performers | P0 |
| US-6 | visitor | click a card to open the original video in a new tab | I can watch it on the platform | P0 |
| US-7 | visitor | see clear loading, empty, and error states | I know what's happening | P0 |
| US-8 | visitor | open a details panel with the transcript and top comments | I understand why a video works | P1 |
| US-9 | visitor | share a URL that reproduces my search | I can send it to a teammate | P1 |
| US-10 | visitor | see TikTok's top search terms and popular creators | I spot rising topics | P2 |
| US-11 | visitor | include Reddit, X/Twitter, Threads, or Facebook videos in a search | I get wider coverage | P2 |

## 6. Functional requirements

### 6.1 Trending view (home)
- FR-1: The default route `/` shows a **Trending** view with platform tabs: TikTok, Instagram, YouTube.
- FR-2: Each tab loads that platform's trending endpoint (see §8) and shows up to 30 cards.
- FR-3: The trending view has a region selector where the endpoint supports one (default `US`).
- FR-4: A "Refresh" control exists, but it serves cached data for as long as the cache TTL hasn't expired (§9.3).

### 6.2 Search
- FR-5: The search bar accepts free text. Input starting with `#` is sent to the hashtag endpoints. Anything else goes to the keyword endpoints.
- FR-6: Platform checkboxes (all checked by default) decide which platforms get queried. Queries to different platforms run in parallel.
- FR-7: Results from all platforms are merged into one list after being converted to the common `Video` model (§7). Each card shows a platform badge.
- FR-8: If one platform fails, its results are left out and a small notice appears ("YouTube unavailable"). The rest of the results still render.
- FR-9: Search state (`q`, `platforms`, `sort`) is kept in the URL query string (US-9).
- FR-10: A "Load more" button fetches the next page wherever the endpoint returns a cursor or token.

### 6.3 Video card
- FR-11: Each card shows the thumbnail, platform badge, creator handle and avatar, a caption truncated to 2 lines, views, likes, comments, post date, and duration.
- FR-12: Numbers use compact formatting (1.2M, 34K).
- FR-13: Clicking a card opens the original URL in a new tab with `rel="noopener noreferrer"`.
- FR-14 (P1): A secondary "Details" action opens a side panel showing the transcript and top 20 comments, both loaded lazily.

### 6.4 Sorting and filtering
- FR-15: Sort options are **Most viewed**, **Most liked**, **Most commented**, **Engagement rate** (`(likes+comments+shares)/views`), and **Newest**.
- FR-16: Sorting runs on the client over the results already loaded.
- FR-17 (P1): Filter by date posted (24h / 7d / 30d / any) when the source returns timestamps.

## 7. Normalized data model

Every platform's response is mapped on the server to this shape:

```ts
type Platform = "tiktok" | "instagram" | "youtube" | "reddit" | "twitter" | "threads" | "facebook";

interface Video {
  id: string;              // platform-native id
  platform: Platform;
  url: string;             // canonical public URL
  thumbnailUrl: string | null;
  caption: string;
  author: { handle: string; displayName?: string; avatarUrl?: string; url?: string };
  stats: { views?: number; likes?: number; comments?: number; shares?: number };
  postedAt?: string;       // ISO 8601
  durationSec?: number;
  hashtags?: string[];
  music?: { title?: string; author?: string };
}

interface SearchResponse {
  results: Video[];
  errors: { platform: Platform; message: string }[];
  cursors: Partial<Record<Platform, string>>;
  cached: boolean;
}
```

Fields the platform doesn't return are left `undefined`. Sorting puts items with missing values last.

## 8. Scrape Creators endpoints used

Base URL: `https://api.scrapecreators.com`. Auth: header `x-api-key: <key>`.

| Use | Platform | Endpoint | Priority |
|---|---|---|---|
| Trending | TikTok | `GET /v1/tiktok/get-trending-feed` | P0 |
| Trending | Instagram | `GET /v1/instagram/reels/trending` | P0 |
| Trending | YouTube | `GET /v1/youtube/shorts/trending` | P0 |
| Keyword search | TikTok | `GET /v1/tiktok/search/keyword` | P0 |
| Hashtag search | TikTok | `GET /v1/tiktok/search/hashtag` | P0 |
| Keyword search | Instagram | `GET /v2/instagram/reels/search` | P0 |
| Hashtag search | Instagram | `GET /v1/instagram/search/hashtag` | P0 |
| Keyword search | YouTube | `GET /v1/youtube/search` | P0 |
| Hashtag search | YouTube | `GET /v1/youtube/search/hashtag` | P0 |
| Transcript | TikTok / IG / YT | `/v1/tiktok/video/transcript`, `/v2/instagram/media/transcript`, `/v1/youtube/video/transcript` | P1 |
| Comments | TikTok / IG / YT | `/v1/tiktok/video/comments`, `/v2/instagram/post/comments`, `/v1/youtube/video/comments` | P1 |
| Rising topics | TikTok | `/v1/tiktok/search/top`, `/v1/tiktok/creators/popular` | P2 |
| Wider search | Others | `/v1/reddit/search`, `/v1/twitter/search/posts`, `/v1/threads/search`, `/v1/facebook/search/videos` | P2 |

**Error codes to handle:** 400 (bad params), 401 (bad key), 402 (out of credits), 403 (blocked or age-restricted), 404 (not found), 500 (upstream). On 402 the UI shows "Service temporarily unavailable". Credit details are never shown to end users.

> Exact query parameters and response field paths for each endpoint must be checked against the live docs (or the OpenAPI spec at `https://docs.scrapecreators.com/openapi.json`) during implementation. Each mapper gets a test fixture built from a real response.

## 9. Architecture

```
Browser (React SPA)
   │  fetch /api/trending?platform=tiktok
   │  fetch /api/search?q=...&platforms=tiktok,youtube
   ▼
Netlify Functions (Node 22, TypeScript)
   ├─ validate + rate-limit input
   ├─ check cache (Netlify Blobs)
   ├─ call Scrape Creators with x-api-key (env var)
   ├─ normalize → Video[]
   └─ return JSON + Cache-Control
   ▼
api.scrapecreators.com
```

### 9.1 Stack
- **Frontend:** Vite + React + TypeScript, Tailwind CSS, TanStack Query for fetching and caching data.
- **Backend:** Netlify Functions (TypeScript). The `netlify.toml` redirect sends `/api/*` to `/.netlify/functions/:splat`.
- **Cache:** Netlify Blobs store (`trend-cache`), plus `Cache-Control`/`Netlify-CDN-Cache-Control` headers.
- **Testing:** Vitest for unit tests (mappers, sorting, input validation) and Playwright for a smoke test of the main flows.
- **Tooling:** ESLint + Prettier, with `npm run lint`, `typecheck`, `test`, `build`.

### 9.2 API routes (our functions)
| Route | Params | Returns |
|---|---|---|
| `GET /api/trending` | `platform` (req), `region` (opt) | `SearchResponse` |
| `GET /api/search` | `q` (req, 1–100 chars), `platforms` (csv), `cursor.<platform>` (opt) | `SearchResponse` |
| `GET /api/details` (P1) | `platform`, `url` | `{ transcript?: string; comments: Comment[] }` |

### 9.3 Caching and cost control
- Trending responses are cached for **15 minutes** per `platform+region`.
- Search responses are cached for **10 minutes** per normalized `q+platform+cursor`.
- Details responses are cached for **24 hours**.
- Per-IP limit: **30 requests/minute** on `/api/*`. Anything above that gets HTTP 429.
- Expected cost: about 1 credit per upstream call. Ten searches × 3 platforms = 30 credits when nothing is cached.

### 9.4 Configuration
| Env var | Where | Purpose |
|---|---|---|
| `SCRAPE_CREATORS_API_KEY` | Netlify site env (Functions scope) | Upstream auth. **Never committed or exposed to the client.** |
| `CACHE_TTL_TRENDING_SEC` | optional | Overrides the default of 900 |
| `CACHE_TTL_SEARCH_SEC` | optional | Overrides the default of 600 |

`.env` goes in `.gitignore`. A `.env.example` holds placeholder values only.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Cached API responses take under 300 ms server time. LCP is under 2.5 s on a 4G mid-range phone. Images lazy-load. |
| Security | The API key exists only in function env. Inputs are validated and length-capped. Captions are rendered as text, never as HTML. A CSP header is set in `netlify.toml`. |
| Reliability | One platform failing never fails the whole request. Upstream timeout is 15 s per call. |
| Accessibility | WCAG 2.1 AA: keyboard-navigable tabs and cards, alt text from captions, visible focus, contrast that passes in both light and dark themes. |
| Responsiveness | The grid is 1 column on phones, 2–3 on tablets, and 4–5 on desktop. |
| Privacy | No tracking cookies. Only public data is shown. Nothing about users is stored. |
| Compliance | Show a footer note that content belongs to its creators and links go to the original posts. |

## 11. UX outline

1. **Header:** logo, search bar with a platform multi-select, and a light/dark toggle.
2. **Home (Trending):** platform tabs → region selector → sort dropdown → card grid.
3. **Search results:** query summary chip ("#fitness · TikTok, YouTube · 57 results"), any per-platform error notices, sort dropdown, card grid, "Load more".
4. **Details panel (P1):** a drawer on the right (full screen on mobile) with an embedded thumbnail, stats, transcript, and comments.
5. **States:** skeleton cards while loading, an empty state with suggested hashtags, and an error state with a retry button.

## 12. Delivery plan

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 — Scaffold** | Vite + React + TS, Tailwind, Netlify config, lint/test setup, `.env.example` | `npm run build` passes and a Netlify preview deploys |
| **M1 — Trending** | `/api/trending` for 3 platforms, normalizers, card grid, tabs | Trending shows real data on the preview deploy |
| **M2 — Search** | `/api/search`, hashtag/keyword routing, merging, partial-failure handling, URL state | US-3 through US-7 and US-9 pass manual QA |
| **M3 — Hardening** | Caching, rate limit, error mapping, a11y pass, Playwright smoke | Lighthouse ≥ 90 for perf and a11y. No key in the client bundle (grep check in CI). |
| **M4 — Launch** | Merge to `main`, production deploy, README | Production URL live and the smoke test passes against it |
| **M5 — P1/P2** | Details panel, rising topics, extra platforms | Each feature is behind its own PR |

**Branching:** work happens on `claude/dreamy-hypatia-1332u7` (or feature branches off it). It's merged to `main` once milestone exit criteria pass, and Netlify deploys production from `main`.

## 13. Success metrics
- Under 1% of `/api/*` requests return 5xx, measured over 7 days.
- Cache hit rate of at least 60% on trending routes.
- Median time to first results under 3 s.
- Credit spend stays within the budget the owner sets (to be confirmed).

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Upstream response shapes change | Cards break | Mappers are defensive (optional chaining, fallbacks), with a fixture test per endpoint |
| Credit burn from traffic spikes or abuse | Unexpected cost | Caching, per-IP rate limit, query length cap, and a 402 shown as a friendly error |
| A platform's endpoint returns nothing or errors | Gaps in results | Partial-failure UI. Other platforms still return results. |
| Thumbnail URLs expire or block hotlinking | Broken images | Placeholder fallback on `onError`. Image proxy function considered for P1. |
| API key leaks | Third parties spend the credits | Server-only env var, CI grep for the key pattern in `dist/`, and the key is rotated if exposed |
| Dev container can't reach `api.scrapecreators.com` directly (egress blocked during setup) | Can't test live from the build session | Develop against recorded fixtures and verify live on Netlify deploy previews |

## 15. Open questions
1. Final product name and branding?
2. Monthly credit budget and the alert threshold to set?
3. Is the default region `US`, or should region be auto-detected?
4. Should P2 platforms (Reddit, X, Threads, Facebook) ship in v1 or later?
5. Should the Netlify site be created by Claude through the Netlify connector, or by the owner?
6. Should changes merge to `main` directly or go through a reviewed PR?
