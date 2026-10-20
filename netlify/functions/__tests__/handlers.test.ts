// Handler tests for /api/trending and /api/search. Connectors, cache and rate limit are mocked;
// nothing here touches the network or Netlify Blobs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Platform, SearchResponse, Video } from "../../../shared/types";
import { ScrapeCreatorsError, type ScrapeCreatorsErrorKind } from "../lib/scrapeCreators";

vi.mock("../lib/connectors", () => {
  const mk = (platform: string) => ({ platform, trending: vi.fn(), searchKeyword: vi.fn(), searchHashtag: vi.fn() });
  return { connectors: { tiktok: mk("tiktok"), instagram: mk("instagram"), youtube: mk("youtube") } };
});
vi.mock("../lib/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/cache")>();
  return { ...actual, cacheGet: vi.fn(async () => undefined), cacheSet: vi.fn(async () => undefined) };
});
vi.mock("../lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rateLimit")>();
  return { ...actual, checkRateLimit: vi.fn(async () => ({ allowed: true })) };
});

const { connectors } = await import("../lib/connectors");
const cache = await import("../lib/cache");
const rateLimit = await import("../lib/rateLimit");
const trending = (await import("../trending")).default;
const search = (await import("../search")).default;

const KEY = "sk_live_STUB_KEY_must_never_leak_42";
const PASSWORD = "hunter2-correct-horse";

const video = (platform: Platform, id: string): Video => ({
  id,
  platform,
  url: `https://example.test/${platform}/${id}`,
  thumbnailUrl: null,
  caption: `${platform} ${id}`,
  author: { handle: "someone" },
  stats: { views: 1 },
});
const vids = (platform: Platform, ...ids: string[]) => ids.map((id) => video(platform, id));
const scErr = (kind: ScrapeCreatorsErrorKind, status?: number) =>
  // Message mimics the real client and embeds the key to prove it never reaches the response.
  new ScrapeCreatorsError(kind, `GET /v1/x failed: HTTP ${status ?? 0} (${kind}) ${KEY} credits exhausted`, status);

const call = (fn: (r: Request) => Promise<Response>, path: string, init: RequestInit = {}) =>
  fn(new Request(`https://example.test${path}`, init));

/** Every response must be JSON+nosniff and never contain the stubbed key. */
async function read(res: Response) {
  const text = await res.text();
  expect(res.headers.get("Content-Type")).toBe("application/json");
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(text).not.toContain(KEY);
  expect(JSON.stringify([...res.headers.entries()])).not.toContain(KEY);
  return { status: res.status, body: JSON.parse(text), headers: res.headers, text };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("SCRAPECREATORS_API_KEY", KEY);
  vi.stubEnv("APP_PASSWORD", "");
  for (const c of Object.values(connectors)) {
    vi.mocked(c.trending).mockReset().mockResolvedValue({ videos: [] });
    vi.mocked(c.searchKeyword).mockReset().mockResolvedValue({ videos: [] });
    vi.mocked(c.searchHashtag).mockReset().mockResolvedValue({ videos: [] });
  }
  vi.mocked(cache.cacheGet).mockReset().mockResolvedValue(undefined);
  vi.mocked(cache.cacheSet).mockReset().mockResolvedValue(undefined);
  vi.mocked(rateLimit.checkRateLimit).mockReset().mockResolvedValue({ allowed: true });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
});

describe("GET /api/trending", () => {
  it("returns a SearchResponse for a platform and caches it", async () => {
    vi.mocked(connectors.tiktok.trending).mockResolvedValue({ videos: vids("tiktok", "a", "b") });
    const { status, body, headers } = await read(await call(trending, "/api/trending?platform=tiktok&region=gb"));
    expect(status).toBe(200);
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual({ results: vids("tiktok", "a", "b"), errors: [], cursors: {}, cached: false });
    expect(connectors.tiktok.trending).toHaveBeenCalledWith(expect.objectContaining({ region: "GB" }));
    expect(cache.cacheSet).toHaveBeenCalledWith("trending/tiktok/GB", { videos: vids("tiktok", "a", "b") }, 900);
  });

  it("defaults region to US", async () => {
    await call(trending, "/api/trending?platform=tiktok");
    expect(connectors.tiktok.trending).toHaveBeenCalledWith(expect.objectContaining({ region: "US" }));
  });

  it.each(["", "?platform=", "?platform=facebook", "?platform=tiktok,youtube"])("400 for platform %j", async (qs) => {
    const { status, body } = await read(await call(trending, `/api/trending${qs}`));
    expect(status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(connectors.tiktok.trending).not.toHaveBeenCalled();
  });

  it.each(["USA", "U", "1A", "u$", "%20US%20X"])("400 for region %j", async (region) => {
    const { status } = await read(await call(trending, `/api/trending?platform=tiktok&region=${region}`));
    expect(status).toBe(400);
  });

  it("405 for non-GET", async () => {
    const { status, headers } = await read(await call(trending, "/api/trending?platform=tiktok", { method: "POST" }));
    expect(status).toBe(405);
    expect(headers.get("Allow")).toBe("GET");
  });

  it("cache hit skips the connector and sets cached:true", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue({ videos: vids("youtube", "z") });
    const { status, body } = await read(await call(trending, "/api/trending?platform=youtube"));
    expect(status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.results).toEqual(vids("youtube", "z"));
    expect(connectors.youtube.trending).not.toHaveBeenCalled();
  });

  it("402 upstream → 503 with no credit/key wording", async () => {
    vi.mocked(connectors.tiktok.trending).mockRejectedValue(scErr("out_of_credits", 402));
    const { status, body, text } = await read(await call(trending, "/api/trending?platform=tiktok"));
    expect(status).toBe(503);
    expect(body.error).toBe("Service temporarily unavailable");
    expect(text.toLowerCase()).not.toMatch(/credit|key/);
    expect(cache.cacheSet).not.toHaveBeenCalled();
  });

  it("timeout → 502 with safe message", async () => {
    vi.mocked(connectors.instagram.trending).mockRejectedValue(scErr("timeout"));
    const { status, body } = await read(await call(trending, "/api/trending?platform=instagram"));
    expect(status).toBe(502);
    expect(body.errors).toEqual([{ platform: "instagram", message: "Instagram is temporarily unavailable" }]);
  });

  it("logs only kind/status/path server-side", async () => {
    vi.mocked(connectors.tiktok.trending).mockRejectedValue(scErr("forbidden", 403));
    await call(trending, "/api/trending?platform=tiktok");
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("kind=forbidden");
    expect(logged).toContain("path=/v1/x");
    expect(logged).not.toContain(KEY);
  });
});

describe("password gate", () => {
  const withPw = (pw?: string) =>
    call(trending, "/api/trending?platform=tiktok", pw === undefined ? {} : { headers: { "x-app-password": pw } });

  it("set + missing header → 401", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    const { status, body, text } = await read(await withPw());
    expect(status).toBe(401);
    expect(body).toEqual({ error: "Password required" });
    expect(text).not.toContain(PASSWORD);
    expect(connectors.tiktok.trending).not.toHaveBeenCalled();
  });

  it("set + wrong password → 401", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    expect((await read(await withPw("nope"))).status).toBe(401);
  });

  it("set + right password → 200", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    expect((await read(await withPw(PASSWORD))).status).toBe(200);
  });

  it("unset (or blank) → open", async () => {
    vi.stubEnv("APP_PASSWORD", "   ");
    expect((await read(await withPw())).status).toBe(200);
  });

  it("also gates /api/search", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    expect((await read(await call(search, "/api/search?q=cats"))).status).toBe(401);
  });

  it("failed password attempts are rate limited too", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({ allowed: false, retryAfterSec: 12 });
    const { status, headers } = await read(await withPw("guess"));
    expect(status).toBe(429);
    expect(headers.get("Retry-After")).toBe("12");
  });

  it("method check runs before the password check", async () => {
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    expect((await read(await call(trending, "/api/trending", { method: "DELETE" }))).status).toBe(405);
  });
});

describe("rate limit", () => {
  it("429 with Retry-After before validation or upstream", async () => {
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({ allowed: false, retryAfterSec: 37 });
    for (const [fn, path] of [
      [trending, "/api/trending?platform=bogus"],
      [search, "/api/search?q=cats"],
    ] as const) {
      const { status, body, headers } = await read(await call(fn, path));
      expect(status).toBe(429);
      expect(headers.get("Retry-After")).toBe("37");
      expect(typeof body.error).toBe("string");
    }
    expect(connectors.tiktok.searchKeyword).not.toHaveBeenCalled();
  });
});

describe("GET /api/search", () => {
  it("routes plain text to keyword search on all platforms by default", async () => {
    const { status } = await read(await call(search, "/api/search?q=%20cat%20videos%20"));
    expect(status).toBe(200);
    for (const p of ["tiktok", "instagram", "youtube"] as const) {
      expect(connectors[p].searchKeyword).toHaveBeenCalledWith("cat videos", expect.objectContaining({ cursor: undefined }));
      expect(connectors[p].searchHashtag).not.toHaveBeenCalled();
    }
  });

  it("routes #tag to hashtag search with the bare tag", async () => {
    await call(search, "/api/search?q=%23fitness&platforms=tiktok");
    expect(connectors.tiktok.searchHashtag).toHaveBeenCalledWith("fitness", expect.anything());
    expect(connectors.tiktok.searchKeyword).not.toHaveBeenCalled();
    expect(connectors.youtube.searchHashtag).not.toHaveBeenCalled();
  });

  it.each([
    ["missing q", ""],
    ["blank q", "?q=%20%20"],
    ["'#' alone", "?q=%23"],
    ["'##  ' only", "?q=%23%23%20"],
    ["101 chars", `?q=${"a".repeat(101)}`],
    ["invalid platform in csv", "?q=cats&platforms=tiktok,myspace"],
    ["empty platform list", "?q=cats&platforms=,,"],
    ["cursor too long", `?q=cats&platforms=tiktok&cursor.tiktok=${"c".repeat(501)}`],
  ])("400 for %s", async (_name, qs) => {
    const { status, body } = await read(await call(search, `/api/search${qs}`));
    expect(status).toBe(400);
    expect(typeof body.error).toBe("string");
    for (const c of Object.values(connectors)) {
      expect(c.searchKeyword).not.toHaveBeenCalled();
      expect(c.searchHashtag).not.toHaveBeenCalled();
    }
  });

  it("accepts exactly 100 chars", async () => {
    expect((await read(await call(search, `/api/search?q=${"a".repeat(100)}&platforms=youtube`))).status).toBe(200);
  });

  it("dedupes and normalizes the platforms csv", async () => {
    await call(search, "/api/search?q=cats&platforms=YouTube,%20youtube,tiktok");
    expect(connectors.youtube.searchKeyword).toHaveBeenCalledTimes(1);
    expect(connectors.tiktok.searchKeyword).toHaveBeenCalledTimes(1);
    expect(connectors.instagram.searchKeyword).not.toHaveBeenCalled();
  });

  it("partial failure → 200 with safe error message and no raw upstream text", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockResolvedValue({ videos: vids("tiktok", "1") });
    vi.mocked(connectors.youtube.searchKeyword).mockRejectedValue(scErr("upstream", 500));
    const { status, body, text } = await read(await call(search, "/api/search?q=cats&platforms=tiktok,youtube"));
    expect(status).toBe(200);
    expect(body.results).toEqual(vids("tiktok", "1"));
    expect(body.errors).toEqual([{ platform: "youtube", message: "YouTube is temporarily unavailable" }]);
    expect(text).not.toContain("HTTP 500");
    expect(text).not.toContain("/v1/");
    // only the good platform is cached
    expect(cache.cacheSet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cache.cacheSet).mock.calls[0][0]).toMatch(/^search\/tiktok\//);
  });

  it("all fail with out_of_credits/unauthorized → 503 without credit/key wording", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockRejectedValue(scErr("out_of_credits", 402));
    vi.mocked(connectors.instagram.searchKeyword).mockRejectedValue(scErr("unauthorized", 401));
    vi.mocked(connectors.youtube.searchKeyword).mockRejectedValue(scErr("out_of_credits", 402));
    const { status, body, text } = await read(await call(search, "/api/search?q=cats"));
    expect(status).toBe(503);
    expect(body.error).toBe("Service temporarily unavailable");
    expect(body.errors).toHaveLength(3);
    expect(text.toLowerCase()).not.toMatch(/credit|key|unauthori|402|401/);
  });

  it("missing key everywhere → 503", async () => {
    for (const c of Object.values(connectors)) vi.mocked(c.searchKeyword).mockRejectedValue(scErr("missing_key"));
    expect((await read(await call(search, "/api/search?q=cats"))).status).toBe(503);
  });

  it("all fail upstream → 502 with errors[]", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockRejectedValue(scErr("upstream", 500));
    vi.mocked(connectors.youtube.searchKeyword).mockRejectedValue(scErr("forbidden", 403));
    vi.mocked(connectors.instagram.searchKeyword).mockRejectedValue(new Error(`boom ${KEY}`));
    const { status, body } = await read(await call(search, "/api/search?q=cats"));
    expect(status).toBe(502);
    expect(body.errors.map((e: { platform: string }) => e.platform)).toEqual(["tiktok", "instagram", "youtube"]);
  });

  it("all upstream 400 → 400", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockRejectedValue(scErr("bad_request", 400));
    expect((await read(await call(search, "/api/search?q=cats&platforms=tiktok"))).status).toBe(400);
  });

  it("not_found → empty results, no error", async () => {
    vi.mocked(connectors.instagram.searchHashtag).mockRejectedValue(scErr("not_found", 404));
    vi.mocked(connectors.tiktok.searchHashtag).mockResolvedValue({ videos: vids("tiktok", "t1") });
    const { status, body } = await read(await call(search, "/api/search?q=%23nothing&platforms=instagram,tiktok"));
    expect(status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(body.results).toEqual(vids("tiktok", "t1"));
  });

  it("not_found on every platform → 200 empty", async () => {
    for (const c of Object.values(connectors)) vi.mocked(c.searchKeyword).mockRejectedValue(scErr("not_found", 404));
    const { status, body } = await read(await call(search, "/api/search?q=zzzz"));
    expect(status).toBe(200);
    expect(body).toEqual({ results: [], errors: [], cursors: {}, cached: false });
  });

  it("interleaves round-robin across platforms and dedupes by platform+id", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockResolvedValue({ videos: vids("tiktok", "1", "2", "1", "3") });
    vi.mocked(connectors.instagram.searchKeyword).mockResolvedValue({ videos: vids("instagram", "1") });
    vi.mocked(connectors.youtube.searchKeyword).mockResolvedValue({ videos: vids("youtube", "1", "2") });
    const { body } = await read(await call(search, "/api/search?q=cats"));
    const ids = (body as SearchResponse).results.map((v) => `${v.platform}:${v.id}`);
    expect(ids).toEqual(["tiktok:1", "instagram:1", "youtube:1", "tiktok:2", "youtube:2", "tiktok:3"]);
  });

  it("passes cursors through and returns next cursors", async () => {
    vi.mocked(connectors.tiktok.searchKeyword).mockResolvedValue({ videos: [], nextCursor: "t-next" });
    vi.mocked(connectors.youtube.searchKeyword).mockResolvedValue({ videos: [], nextCursor: "y-next" });
    vi.mocked(connectors.instagram.searchKeyword).mockResolvedValue({ videos: [] });
    const { body } = await read(
      await call(search, "/api/search?q=cats&cursor.tiktok=30&cursor.youtube=tok%2Babc&cursor.myspace=ignored"),
    );
    expect(connectors.tiktok.searchKeyword).toHaveBeenCalledWith("cats", expect.objectContaining({ cursor: "30" }));
    expect(connectors.youtube.searchKeyword).toHaveBeenCalledWith("cats", expect.objectContaining({ cursor: "tok+abc" }));
    expect(connectors.instagram.searchKeyword).toHaveBeenCalledWith("cats", expect.objectContaining({ cursor: undefined }));
    expect(body.cursors).toEqual({ tiktok: "t-next", youtube: "y-next" });
  });

  it("cached:true only when every platform came from cache", async () => {
    vi.mocked(cache.cacheGet).mockImplementation(async (key: string) =>
      key.startsWith("search/tiktok/") ? { videos: vids("tiktok", "c") } : undefined,
    );
    const partial = await read(await call(search, "/api/search?q=cats&platforms=tiktok,youtube"));
    expect(partial.body.cached).toBe(false);
    expect(connectors.tiktok.searchKeyword).not.toHaveBeenCalled();
    expect(connectors.youtube.searchKeyword).toHaveBeenCalledTimes(1);

    vi.mocked(cache.cacheGet).mockResolvedValue({ videos: vids("tiktok", "c") });
    const full = await read(await call(search, "/api/search?q=cats&platforms=tiktok,youtube"));
    expect(full.body.cached).toBe(true);
  });

  it("uses a normalized, case-insensitive cache key including the cursor", async () => {
    await call(search, "/api/search?q=%20Cats%20&platforms=tiktok&cursor.tiktok=X");
    await call(search, "/api/search?q=cats&platforms=tiktok&cursor.tiktok=X");
    await call(search, "/api/search?q=cats&platforms=tiktok&cursor.tiktok=Y");
    const keys = vi.mocked(cache.cacheGet).mock.calls.map((c) => c[0]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});
