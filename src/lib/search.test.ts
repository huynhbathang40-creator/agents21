import { describe, expect, it } from "vitest";
import type { SearchResponse, Video } from "../../shared/types";
import {
  documentTitle,
  firstPageParam,
  isAllPlatforms,
  isHashtagQuery,
  mergePages,
  nextPageParam,
  normalizeQuery,
  orderPlatforms,
  resultCountLabel,
  searchSummary,
} from "./search";

function video(platform: Video["platform"], id: string, views?: number): Video {
  return { id, platform, url: `https://example.com/${id}`, thumbnailUrl: null, caption: id, author: { handle: "h" }, stats: { views } };
}

function page(partial: Partial<SearchResponse>): SearchResponse {
  return { results: [], errors: [], cursors: {}, cached: false, ...partial };
}

describe("normalizeQuery", () => {
  it("trims, collapses whitespace and caps at 100 chars", () => {
    expect(normalizeQuery("  cat   videos ")).toBe("cat videos");
    expect(normalizeQuery("x".repeat(120))).toHaveLength(100);
    expect(normalizeQuery(`${"y".repeat(99)} z`)).toBe("y".repeat(99));
  });

  it("rejects empty, whitespace-only and bare '#' queries", () => {
    expect(normalizeQuery("")).toBeUndefined();
    expect(normalizeQuery("   ")).toBeUndefined();
    expect(normalizeQuery("#")).toBeUndefined();
    expect(normalizeQuery(" ## ")).toBeUndefined();
    expect(normalizeQuery(null)).toBeUndefined();
    expect(normalizeQuery("#fyp")).toBe("#fyp");
  });
});

describe("isHashtagQuery", () => {
  it("detects a leading # after whitespace", () => {
    expect(isHashtagQuery("  #fitness")).toBe(true);
    expect(isHashtagQuery("fitness #gym")).toBe(false);
    expect(isHashtagQuery("")).toBe(false);
  });
});

describe("platform helpers", () => {
  it("orders and dedupes", () => {
    expect(orderPlatforms(["youtube", "tiktok", "youtube"])).toEqual(["tiktok", "youtube"]);
    expect(isAllPlatforms(["youtube", "instagram", "tiktok"])).toBe(true);
    expect(isAllPlatforms(["youtube", "tiktok"])).toBe(false);
  });
});

describe("paging", () => {
  it("first page has no cursors", () => {
    expect(firstPageParam(["youtube", "tiktok"])).toEqual({ platforms: ["tiktok", "youtube"], cursors: {} });
  });

  it("next page requests only platforms that returned a cursor", () => {
    const last = page({ cursors: { youtube: "yt2", tiktok: "", instagram: "ig2" } });
    expect(nextPageParam(last, ["tiktok", "instagram", "youtube"])).toEqual({
      platforms: ["instagram", "youtube"],
      cursors: { instagram: "ig2", youtube: "yt2" },
    });
  });

  it("ignores cursors for platforms that were not requested", () => {
    const last = page({ cursors: { tiktok: "tt2", youtube: "yt2" } });
    expect(nextPageParam(last, ["youtube"])).toEqual({ platforms: ["youtube"], cursors: { youtube: "yt2" } });
  });

  it("returns undefined when no cursors remain", () => {
    expect(nextPageParam(page({}), ["tiktok"])).toBeUndefined();
    expect(nextPageParam(page({ cursors: { tiktok: "  " } }), ["tiktok"])).toBeUndefined();
  });
});

describe("mergePages", () => {
  it("appends pages in order and dedupes by platform+id (first wins)", () => {
    const merged = mergePages([
      page({ results: [video("tiktok", "1", 10), video("youtube", "1", 20)] }),
      page({ results: [video("tiktok", "1", 999), video("tiktok", "2"), video("instagram", "1")] }),
    ]);
    expect(merged.results.map((v) => `${v.platform}:${v.id}`)).toEqual([
      "tiktok:1",
      "youtube:1",
      "tiktok:2",
      "instagram:1",
    ]);
    expect(merged.results[0].stats.views).toBe(10);
  });

  it("collects errors once per platform", () => {
    const merged = mergePages([
      page({ errors: [{ platform: "youtube", message: "YouTube unavailable" }] }),
      page({ errors: [{ platform: "youtube", message: "again" }, { platform: "tiktok", message: "TikTok unavailable" }] }),
    ]);
    expect(merged.errors).toEqual([
      { platform: "youtube", message: "YouTube unavailable" },
      { platform: "tiktok", message: "TikTok unavailable" },
    ]);
  });

  it("handles no pages", () => {
    expect(mergePages([])).toEqual({ results: [], errors: [] });
  });
});

describe("summary and titles", () => {
  it("formats the query summary (PRD §11)", () => {
    expect(searchSummary("#fitness", ["youtube", "tiktok"], 57)).toBe("#fitness · TikTok, YouTube · 57 results");
    expect(searchSummary("cats", ["instagram"], 1)).toBe("cats · Instagram · 1 result");
    expect(searchSummary("cats", ["instagram"])).toBe("cats · Instagram");
    expect(resultCountLabel(0)).toBe("0 results");
  });

  it("builds document titles", () => {
    expect(documentTitle("#fitness")).toBe("#fitness — TrendScope");
    expect(documentTitle("Trending on TikTok")).toBe("Trending on TikTok — TrendScope");
    expect(documentTitle()).toBe("TrendScope");
  });
});
