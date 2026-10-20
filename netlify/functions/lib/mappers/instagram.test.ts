import { describe, expect, it } from "vitest";
import trending from "../__fixtures__/instagram-trending.json";
import keyword from "../__fixtures__/instagram-keyword.json";
import hashtag from "../__fixtures__/instagram-hashtag.json";
import {
  instagramHashtagNextCursor,
  instagramKeywordNextCursor,
  mapInstagramHashtag,
  mapInstagramKeyword,
  mapInstagramTrending,
} from "./instagram";

const GARBAGE: unknown[] = [null, undefined, 42, "str", [], {}, { reels: {} }, { posts: [null, 1, "x"] }];

describe("mapInstagramTrending (doc fixture)", () => {
  const videos = mapInstagramTrending(trending);

  it("maps items with id and a usable url; skips the rest", () => {
    // item 3 has only an id: no url and no shortcode, so there is nothing to link to
    expect(videos.map((v) => v.id)).toEqual(["4000819054877393649", "4000000000000000002"]);
    expect(videos.every((v) => v.platform === "instagram")).toBe(true);
  });

  it("maps the doc example item", () => {
    const [a] = videos;
    expect(a.url).toBe("https://www.instagram.com/reel/DeFw7uwlMLx/");
    expect(a.thumbnailUrl).toBe("https://scontent.cdninstagram.com/example.jpg");
    expect(a.author).toEqual({
      handle: "ufc",
      displayName: "UFC",
      avatarUrl: "https://scontent.cdninstagram.com/example.jpg",
      url: "https://www.instagram.com/ufc/",
    });
    expect(a.stats).toEqual({ views: 5112349, likes: 423127, comments: 1623, shares: undefined });
    expect(a.postedAt).toBe("2026-10-04T23:00:03.000Z");
    expect(a.hashtags).toEqual(["UFC335"]);
    expect(a.music).toEqual({ title: "Original audio", author: "ufc" });
    expect(a.durationSec).toBeUndefined();
  });

  it("falls back to shortcode url, image_versions2 thumbnail, ig_play_count and string counts", () => {
    const b = videos[1];
    expect(b.id).toBe("4000000000000000002");
    expect(b.url).toBe("https://www.instagram.com/reel/SYNTH00002/");
    expect(b.thumbnailUrl).toBe("https://scontent.cdninstagram.com/synthetic.jpg");
    expect(b.stats).toEqual({ views: 3400, likes: 12, comments: undefined, shares: undefined });
    expect(b.author.displayName).toBeUndefined();
    expect(b.author.avatarUrl).toBeUndefined();
    expect(b.music).toBeUndefined();
  });
});

describe("mapInstagramKeyword (doc fixture)", () => {
  const videos = mapInstagramKeyword(keyword);

  it("maps the doc example item (owner, thumbnail_src, duration, music)", () => {
    expect(videos.map((v) => v.id)).toEqual(["3723045213787686915", "3723045213787686999"]);
    const [a] = videos;
    expect(a.url).toBe("https://www.instagram.com/reel/DOq6eV6iIgD/");
    expect(a.thumbnailUrl).toMatch(/550186015_17890754136343371/);
    expect(a.author.handle).toBe("fetchmycamera_");
    expect(a.author.displayName).toBe("Mark | Dog Photographer & Storyteller");
    expect(a.stats).toEqual({ views: undefined, likes: 3487, comments: 90, shares: undefined });
    expect(a.durationSec).toBe(75.7);
    expect(a.music).toEqual({ title: "Smiling Heart", author: "Oliver Max" });
    expect(a.postedAt).toBe("2025-09-16T16:56:45.000Z");
    expect(a.hashtags).toContain("rescuedog");
  });

  it("handles caption objects, unix taken_at, unsafe thumbnails, and missing author", () => {
    const b = videos[1];
    expect(b.caption).toBe("Synthetic caption object #synthetic");
    expect(b.postedAt).toBe(new Date(1758041805 * 1000).toISOString());
    expect(b.thumbnailUrl).toBeNull();
    expect(b.author).toEqual({ handle: "", displayName: undefined, avatarUrl: undefined, url: undefined });
  });

  it("derives the next page from the current page while results exist", () => {
    expect(instagramKeywordNextCursor(videos.length, undefined)).toBe("2");
    expect(instagramKeywordNextCursor(videos.length, "3")).toBe("4");
    expect(instagramKeywordNextCursor(0, "3")).toBeUndefined();
  });
});

describe("mapInstagramHashtag (doc fixture)", () => {
  const videos = mapInstagramHashtag(hashtag);

  it("maps posts[] and skips items without a url or shortcode", () => {
    expect(videos.map((v) => v.id)).toEqual(["3714950709444987377"]);
    const [a] = videos;
    expect(a.author.handle).toBe("_layla_the_boxer");
    expect(a.stats).toEqual({ views: undefined, likes: 35854, comments: 1263, shares: undefined });
    expect(a.durationSec).toBe(65.733);
    expect(a.hashtags).toEqual(["funnydogs", "funny", "whiteboxer", "australianshepherd"]);
    expect(a.music).toEqual({ title: "Original audio", author: "_layla_the_boxer" });
  });

  it("returns the response cursor, and none past Google page 11", () => {
    expect(instagramHashtagNextCursor(hashtag)).toBe("2");
    expect(instagramHashtagNextCursor({ cursor: 12 })).toBeUndefined();
    expect(instagramHashtagNextCursor({})).toBeUndefined();
  });
});

describe("Instagram mappers on garbage input", () => {
  it.each(GARBAGE)("returns [] for %j without throwing", (raw) => {
    expect(mapInstagramTrending(raw)).toEqual([]);
    expect(mapInstagramKeyword(raw)).toEqual([]);
    expect(mapInstagramHashtag(raw)).toEqual([]);
  });
});
