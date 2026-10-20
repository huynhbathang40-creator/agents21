import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import tiktokTrending from "../__fixtures__/tiktok-trending.json";
import tiktokKeyword from "../__fixtures__/tiktok-keyword.json";
import tiktokHashtag from "../__fixtures__/tiktok-hashtag.json";
import igTrending from "../__fixtures__/instagram-trending.json";
import igKeyword from "../__fixtures__/instagram-keyword.json";
import igHashtag from "../__fixtures__/instagram-hashtag.json";
import ytTrending from "../__fixtures__/youtube-trending.json";
import ytKeyword from "../__fixtures__/youtube-keyword.json";
import ytHashtag from "../__fixtures__/youtube-hashtag.json";
import { PLATFORMS } from "../../../../shared/types";
import { ScrapeCreatorsError } from "../scrapeCreators";
import { connectors } from "./index";

const KEY = "sk_test_connector_key";
let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

/** The single upstream request: pathname, query params as an object, and the api key header. */
function lastCall() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const u = new URL(url);
  return {
    origin: u.origin,
    path: u.pathname,
    params: Object.fromEntries(u.searchParams),
    key: (init.headers as Record<string, string>)["x-api-key"],
  };
}

beforeEach(() => {
  vi.stubEnv("SCRAPECREATORS_API_KEY", KEY);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("connectors registry", () => {
  it("has a connector for every platform", () => {
    expect(Object.keys(connectors).sort()).toEqual([...PLATFORMS].sort());
    for (const p of PLATFORMS) expect(connectors[p].platform).toBe(p);
  });
});

describe("tiktok connector", () => {
  const c = connectors.tiktok;

  it("trending: /v1/tiktok/get-trending-feed with region (default US)", async () => {
    respondWith(tiktokTrending);
    const r = await c.trending();
    expect(lastCall()).toEqual({ origin: "https://api.scrapecreators.com", path: "/v1/tiktok/get-trending-feed", params: { region: "US" }, key: KEY });
    expect(r.videos).toHaveLength(3);
    expect(r.nextCursor).toBeUndefined();
  });

  it("trending: passes a custom region upper-cased", async () => {
    respondWith(tiktokTrending);
    await c.trending({ region: "gb" });
    expect(lastCall().params).toEqual({ region: "GB" });
  });

  it("searchKeyword: query + cursor, returns nextCursor", async () => {
    respondWith(tiktokKeyword);
    const r = await c.searchKeyword(" super bowl ", { cursor: "10" });
    expect(lastCall()).toMatchObject({ path: "/v1/tiktok/search/keyword", params: { query: "super bowl", cursor: "10" } });
    expect(r.videos.map((v) => v.id)).toEqual(["7334621391758642478", "7000000000000000222"]);
    expect(r.nextCursor).toBe("12");
  });

  it("searchHashtag: strips '#', omits cursor when absent", async () => {
    respondWith(tiktokHashtag);
    const r = await c.searchHashtag("#fyp");
    expect(lastCall()).toMatchObject({ path: "/v1/tiktok/search/hashtag", params: { hashtag: "fyp" } });
    expect(r.nextCursor).toBe("20");
  });
});

describe("instagram connector", () => {
  const c = connectors.instagram;

  it("trending: /v1/instagram/reels/trending with no params (region ignored)", async () => {
    respondWith(igTrending);
    const r = await c.trending({ region: "US" });
    expect(lastCall()).toMatchObject({ path: "/v1/instagram/reels/trending", params: {}, key: KEY });
    expect(r.videos).toHaveLength(2);
    expect(r.nextCursor).toBeUndefined();
  });

  it("searchKeyword: /v2/instagram/reels/search with query and page=cursor", async () => {
    respondWith(igKeyword);
    const r = await c.searchKeyword("dogs", { cursor: "2" });
    expect(lastCall()).toMatchObject({ path: "/v2/instagram/reels/search", params: { query: "dogs", page: "2" } });
    expect(r.nextCursor).toBe("3");
  });

  it("searchKeyword: first page sends no page param, next cursor is 2", async () => {
    respondWith(igKeyword);
    const r = await c.searchKeyword("dogs");
    expect(lastCall().params).toEqual({ query: "dogs" });
    expect(r.nextCursor).toBe("2");
  });

  it("searchKeyword: empty page ends pagination", async () => {
    respondWith({ success: true, reels: [] });
    expect((await c.searchKeyword("dogs", { cursor: "5" })).nextCursor).toBeUndefined();
  });

  it("searchHashtag: strips '#', sends cursor, returns response cursor", async () => {
    respondWith(igHashtag);
    const r = await c.searchHashtag("##funnydogs", { cursor: "1" });
    expect(lastCall()).toMatchObject({ path: "/v1/instagram/search/hashtag", params: { hashtag: "funnydogs", cursor: "1" } });
    expect(r.videos.map((v) => v.id)).toEqual(["3714950709444987377"]);
    expect(r.nextCursor).toBe("2");
  });
});

describe("youtube connector", () => {
  const c = connectors.youtube;

  it("trending: /v1/youtube/shorts/trending with no params", async () => {
    respondWith(ytTrending);
    const r = await c.trending({ region: "US" });
    expect(lastCall()).toMatchObject({ path: "/v1/youtube/shorts/trending", params: {}, key: KEY });
    expect(r.videos).toHaveLength(3);
    expect(r.nextCursor).toBeUndefined();
  });

  it("searchKeyword: /v1/youtube/search with query and continuationToken", async () => {
    respondWith(ytKeyword);
    const r = await c.searchKeyword("running", { cursor: "tok1" });
    expect(lastCall()).toMatchObject({ path: "/v1/youtube/search", params: { query: "running", continuationToken: "tok1" } });
    expect(r.videos).toHaveLength(3);
    expect(r.nextCursor).toBe("EooDEg...");
  });

  it("searchHashtag: strips '#', uses hashtag + continuationToken", async () => {
    respondWith(ytHashtag);
    const r = await c.searchHashtag("#funny");
    expect(lastCall()).toMatchObject({ path: "/v1/youtube/search/hashtag", params: { hashtag: "funny" } });
    expect(r.nextCursor).toBe("4qmFsgLtBRIJRkVoYX....");
  });
});

describe("connector errors", () => {
  it("propagates ScrapeCreatorsError with the mapped kind", async () => {
    respondWith({ message: "no credits" }, 402);
    await expect(connectors.youtube.trending()).rejects.toMatchObject({ kind: "out_of_credits", status: 402 });
  });

  it("does not call upstream when the key is missing", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "");
    const err = await connectors.tiktok.trending().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScrapeCreatorsError);
    expect((err as ScrapeCreatorsError).kind).toBe("missing_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
