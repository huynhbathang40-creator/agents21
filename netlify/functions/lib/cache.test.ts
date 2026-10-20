import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getStore = vi.fn();
vi.mock("@netlify/blobs", () => ({ getStore: (...args: unknown[]) => getStore(...args) }));

const { cacheGet, cacheSet, searchCacheKey, searchTtlSec, trendingCacheKey, trendingTtlSec } = await import("./cache");

function memoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: vi.fn(async (k: string) => (data.has(k) ? structuredClone(data.get(k)) : null)),
    setJSON: vi.fn(async (k: string, v: unknown) => void data.set(k, structuredClone(v))),
  };
}

beforeEach(() => {
  getStore.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("cache", () => {
  it("round-trips within the TTL and expires after it", async () => {
    const s = memoryStore();
    getStore.mockReturnValue(s);
    await cacheSet("k", { videos: [1] }, 10, 1_000);
    expect(getStore).toHaveBeenCalledWith("trend-cache");
    expect(s.data.get("k")).toEqual({ expiresAt: 11_000, payload: { videos: [1] } });
    expect(await cacheGet("k", 10_999)).toEqual({ videos: [1] });
    expect(await cacheGet("k", 11_000)).toBeUndefined();
    expect(await cacheGet("missing", 0)).toBeUndefined();
  });

  it("ignores malformed entries", async () => {
    const s = memoryStore();
    s.data.set("bad", "not an entry");
    getStore.mockReturnValue(s);
    expect(await cacheGet("bad")).toBeUndefined();
  });

  it("degrades silently when Blobs is unavailable (getStore throws)", async () => {
    getStore.mockImplementation(() => {
      throw new Error("MissingBlobsEnvironmentError");
    });
    await expect(cacheGet("k")).resolves.toBeUndefined();
    await expect(cacheSet("k", {}, 10)).resolves.toBeUndefined();
  });

  it("degrades silently when Blobs calls reject", async () => {
    getStore.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error("network")),
      setJSON: vi.fn().mockRejectedValue(new Error("network")),
    });
    await expect(cacheGet("k")).resolves.toBeUndefined();
    await expect(cacheSet("k", {}, 10)).resolves.toBeUndefined();
  });

  it("reads TTLs from env with sane defaults", () => {
    expect(trendingTtlSec()).toBe(900);
    expect(searchTtlSec()).toBe(600);
    vi.stubEnv("CACHE_TTL_TRENDING_SEC", "60");
    vi.stubEnv("CACHE_TTL_SEARCH_SEC", "abc");
    expect(trendingTtlSec()).toBe(60);
    expect(searchTtlSec()).toBe(600);
    vi.stubEnv("CACHE_TTL_SEARCH_SEC", "-5");
    expect(searchTtlSec()).toBe(600);
  });

  it("normalizes keys", () => {
    expect(trendingCacheKey("tiktok", "gb")).toBe("trending/tiktok/GB");
    expect(trendingCacheKey("youtube", "GB")).toBe(trendingCacheKey("youtube", "US"));
    expect(searchCacheKey("tiktok", "keyword", "  Cat   Videos ")).toBe(searchCacheKey("tiktok", "keyword", "cat videos"));
    expect(searchCacheKey("tiktok", "keyword", "cats")).not.toBe(searchCacheKey("tiktok", "hashtag", "cats"));
    expect(searchCacheKey("tiktok", "keyword", "cats")).not.toBe(searchCacheKey("youtube", "keyword", "cats"));
    expect(searchCacheKey("tiktok", "keyword", "cats", "Abc")).not.toBe(searchCacheKey("tiktok", "keyword", "cats", "abc"));
    expect(searchCacheKey("tiktok", "keyword", "x".repeat(100))).toMatch(/^search\/tiktok\/[0-9a-f]{64}$/);
  });
});
