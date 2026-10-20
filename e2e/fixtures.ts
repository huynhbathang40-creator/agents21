// Shared Playwright fixtures. Every /api/* route is mocked with page.route and every non-localhost
// request is aborted, so tests never reach Scrape Creators (credits) or any platform CDN.
import { test as base, expect, type Page, type Request } from "@playwright/test";
import type { HealthResponse, Platform, SearchResponse, Video } from "../shared/types";

export { expect };

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Handler for a mocked route: receives the parsed request URL and the raw request. */
export type Handler = (url: URL, request: Request) => MockResponse | Promise<MockResponse>;

let seq = 0;

/** A fake, normalized Video. thumbnailUrl is null so no image is ever fetched. */
export function makeVideo(overrides: Partial<Video> & { platform?: Platform } = {}): Video {
  seq += 1;
  const platform = overrides.platform ?? "tiktok";
  const id = overrides.id ?? `${platform}-${seq}`;
  const handle = overrides.author?.handle ?? `creator${seq}`;
  return {
    id,
    platform,
    url: `https://example.com/${platform}/${handle}/${id}`,
    thumbnailUrl: null,
    caption: `Fake ${platform} video ${id}`,
    author: { handle },
    stats: { views: 1000, likes: 100, comments: 10 },
    postedAt: "2026-10-01T12:00:00.000Z",
    durationSec: 30,
    ...overrides,
  };
}

export function response(results: Video[], extra: Partial<SearchResponse> = {}): SearchResponse {
  return { results, errors: [], cursors: {}, cached: false, ...extra };
}

/** Three trending videos per platform with distinct stats so every sort key orders them differently. */
export function trendingFixture(platform: Platform): Video[] {
  return [
    makeVideo({
      platform,
      id: `${platform}-a`,
      author: { handle: `${platform}_alpha` },
      caption: `${platform} alpha`,
      stats: { views: 100_000, likes: 1_000, comments: 50 },
      postedAt: "2026-09-01T00:00:00.000Z",
    }),
    makeVideo({
      platform,
      id: `${platform}-b`,
      author: { handle: `${platform}_bravo` },
      caption: `${platform} bravo`,
      stats: { views: 50_000, likes: 20_000, comments: 10 },
      postedAt: "2026-10-01T00:00:00.000Z",
    }),
    makeVideo({
      platform,
      id: `${platform}-c`,
      author: { handle: `${platform}_charlie` },
      caption: `${platform} charlie`,
      stats: { views: 10_000, likes: 5_000, comments: 900 },
      postedAt: "2026-08-01T00:00:00.000Z",
    }),
  ];
}

/** Default search: two videos per requested platform, no further pages. */
export function searchFixture(q: string, platforms: Platform[]): Video[] {
  return platforms.flatMap((platform) => [
    makeVideo({ platform, id: `${platform}-s1`, author: { handle: `${platform}_one` }, caption: `${q} on ${platform} one` }),
    makeVideo({ platform, id: `${platform}-s2`, author: { handle: `${platform}_two` }, caption: `${q} on ${platform} two` }),
  ]);
}

const ALL: Platform[] = ["tiktok", "instagram", "youtube"];

export function requestedPlatforms(url: URL): Platform[] {
  const raw = url.searchParams.get("platforms");
  if (!raw) return [...ALL];
  return raw.split(",").filter((p): p is Platform => (ALL as string[]).includes(p));
}

export const defaultHealth: HealthResponse = {
  status: "ok",
  apiKeyConfigured: true,
  passwordProtected: false,
  time: "2026-10-20T00:00:00.000Z",
};

export class MockApi {
  health: Handler = () => ({ body: defaultHealth });
  trending: Handler = (url) => ({ body: response(trendingFixture((url.searchParams.get("platform") ?? "tiktok") as Platform)) });
  search: Handler = (url) => ({ body: response(searchFixture(url.searchParams.get("q") ?? "", requestedPlatforms(url))) });
  /** Every mocked /api request, in order. */
  readonly calls: URL[] = [];

  callsTo(path: "/api/health" | "/api/trending" | "/api/search"): URL[] {
    return this.calls.filter((u) => u.pathname === path);
  }

  async install(page: Page): Promise<void> {
    // Block everything that isn't the local preview server (thumbnails, fonts, real APIs).
    await page.context().route(/^(?!https?:\/\/(localhost|127\.0\.0\.1)[:/]).*/, (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      return route.abort("blockedbyclient");
    });
    await page.route(/\/api\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      this.calls.push(url);
      let handler: Handler | undefined;
      if (url.pathname === "/api/health") handler = this.health;
      else if (url.pathname === "/api/trending") handler = this.trending;
      else if (url.pathname === "/api/search") handler = this.search;
      const res = handler ? await handler(url, request) : { status: 404, body: { error: "Not found" } };
      await route.fulfill({
        status: res.status ?? 200,
        contentType: "application/json",
        headers: res.headers,
        body: JSON.stringify(res.body ?? {}),
      });
    });
  }
}

/** `api` is auto-installed before every test (even ones that don't use it); override handlers before navigating. */
export const test = base.extend<{ api: MockApi }>({
  api: [
    async ({ page }, use) => {
      const api = new MockApi();
      await api.install(page);
      await use(api);
    },
    { auto: true },
  ],
});

/** Accessible names of the video card links, in DOM order. */
export async function cardNames(page: Page): Promise<string[]> {
  const links = page.locator("main ul > li > a[target=_blank]");
  return links.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
}

/** Handles (without '@') of the rendered cards, in DOM order. */
export async function cardHandles(page: Page): Promise<string[]> {
  const names = await cardNames(page);
  return names.map((n) => /video by @([^:]+):/.exec(n)?.[1] ?? "");
}
