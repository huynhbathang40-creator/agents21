import { describe, expect, it } from "vitest";
import type { Video } from "../../shared/types";
import { engagementRate, isSortKey, sortVideos } from "./sort";

function video(id: string, stats: Video["stats"] = {}, postedAt?: string): Video {
  return {
    id,
    platform: "tiktok",
    url: `https://www.tiktok.com/@a/video/${id}`,
    thumbnailUrl: null,
    caption: "",
    author: { handle: "a" },
    stats,
    postedAt,
  };
}

const ids = (list: Video[]) => list.map((v) => v.id);

describe("engagementRate", () => {
  it("is (likes + comments + shares) / views", () => {
    expect(engagementRate(video("a", { views: 1000, likes: 50, comments: 30, shares: 20 }))).toBeCloseTo(0.1);
  });

  it("treats missing numerators as 0 when at least one is known", () => {
    expect(engagementRate(video("a", { views: 100, likes: 10 }))).toBeCloseTo(0.1);
  });

  it("is undefined when views are missing or 0", () => {
    expect(engagementRate(video("a", { likes: 10 }))).toBeUndefined();
    expect(engagementRate(video("a", { views: 0, likes: 10 }))).toBeUndefined();
  });

  it("is undefined when no numerator is known", () => {
    expect(engagementRate(video("a", { views: 100 }))).toBeUndefined();
  });
});

describe("sortVideos", () => {
  it("sorts by views descending with missing values last", () => {
    const list = [video("a", { views: 10 }), video("b"), video("c", { views: 30 }), video("d", { views: 20 })];
    expect(ids(sortVideos(list, "views"))).toEqual(["c", "d", "a", "b"]);
  });

  it("sorts by likes and comments", () => {
    const list = [video("a", { likes: 1, comments: 9 }), video("b", { likes: 5, comments: 2 })];
    expect(ids(sortVideos(list, "likes"))).toEqual(["b", "a"]);
    expect(ids(sortVideos(list, "comments"))).toEqual(["a", "b"]);
  });

  it("sorts by engagement rate, unknown rates last", () => {
    const list = [
      video("low", { views: 1000, likes: 10 }),
      video("noviews", { likes: 1000 }),
      video("high", { views: 100, likes: 50 }),
    ];
    expect(ids(sortVideos(list, "engagement"))).toEqual(["high", "low", "noviews"]);
  });

  it("sorts newest first, invalid/missing dates last", () => {
    const list = [
      video("old", {}, "2026-01-01T00:00:00Z"),
      video("none"),
      video("bad", {}, "garbage"),
      video("new", {}, "2026-10-01T00:00:00Z"),
    ];
    expect(ids(sortVideos(list, "newest"))).toEqual(["new", "old", "none", "bad"]);
  });

  it("is stable for ties and for missing values", () => {
    const list = [video("a", { views: 5 }), video("x"), video("b", { views: 5 }), video("y"), video("c", { views: 5 })];
    expect(ids(sortVideos(list, "views"))).toEqual(["a", "b", "c", "x", "y"]);
  });

  it("does not mutate the input", () => {
    const list = [video("a", { views: 1 }), video("b", { views: 2 })];
    sortVideos(list, "views");
    expect(ids(list)).toEqual(["a", "b"]);
  });
});

describe("isSortKey", () => {
  it("accepts known keys only", () => {
    expect(isSortKey("views")).toBe(true);
    expect(isSortKey("engagement")).toBe(true);
    expect(isSortKey("random")).toBe(false);
    expect(isSortKey(undefined)).toBe(false);
  });
});
