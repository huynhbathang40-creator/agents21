import { describe, expect, it } from "vitest";
import trending from "../__fixtures__/tiktok-trending.json";
import keyword from "../__fixtures__/tiktok-keyword.json";
import hashtag from "../__fixtures__/tiktok-hashtag.json";
import { mapTikTokHashtag, mapTikTokKeyword, mapTikTokTrending, tiktokNextCursor } from "./tiktok";

const GARBAGE: unknown[] = [null, undefined, 42, "str", [], {}, { aweme_list: "nope" }, { aweme_list: [null, 1, "x", []] }];

describe("mapTikTokTrending (doc fixture)", () => {
  const videos = mapTikTokTrending(trending);

  it("maps every item that has an id", () => {
    expect(videos.map((v) => v.id)).toEqual(["7540000301621841183", "7540968798585670968", "7000000000000000003"]);
    expect(videos.every((v) => v.platform === "tiktok")).toBe(true);
  });

  it("maps url, thumbnail, author (handle from url when unique_id is absent)", () => {
    const [a] = videos;
    expect(a.url).toBe("https://www.tiktok.com/@breannafriedman0/photo/7540000301621841183");
    expect(a.thumbnailUrl).toMatch(/^https:\/\/p19-pu-sign-useast8\.tiktokcdn-us\.com\//);
    expect(a.author).toEqual({
      handle: "breannafriedman0",
      displayName: "Bre 🤍",
      avatarUrl: expect.stringMatching(/^https:\/\//),
      url: "https://www.tiktok.com/@breannafriedman0",
    });
    expect(a.caption).toContain("#hudsonvalley");
    expect(a.hashtags).toEqual(["hudsonvalley", "fallgetaway", "farm", "upstateny", "resort"]);
  });

  it("maps stats as numbers and postedAt as ISO", () => {
    const [a, b] = videos;
    expect(a.stats).toEqual({ views: 1443873, likes: 71423, comments: 646, shares: 8440 });
    expect(a.postedAt).toBe(new Date(1755543133 * 1000).toISOString());
    expect(b.durationSec).toBe(15);
    expect(b.music).toEqual({ title: "original sound - lyngame.52", author: "lyngame.52" });
    expect(b.hashtags).toEqual(["gaming"]);
  });

  it("leaves missing fields undefined", () => {
    const c = videos[2];
    expect(c.thumbnailUrl).toBeNull();
    expect(c.caption).toBe("");
    expect(c.author.handle).toBe("");
    expect(c.author.url).toBeUndefined();
    expect(c.url).toBe("https://www.tiktok.com/video/7000000000000000003");
    expect(c.stats).toEqual({ views: 1200, likes: undefined, comments: undefined, shares: undefined });
    expect(c.postedAt).toBeUndefined();
    expect(c.durationSec).toBeUndefined();
    expect(c.hashtags).toBeUndefined();
    expect(c.music).toBeUndefined();
  });
});

describe("mapTikTokKeyword (doc fixture)", () => {
  const videos = mapTikTokKeyword(keyword);

  it("unwraps aweme_info, accepts unwrapped items, skips items without id", () => {
    expect(videos.map((v) => v.id)).toEqual(["7334621391758642478", "7000000000000000222"]);
  });

  it("maps the doc example item", () => {
    const [a] = videos;
    expect(a.url).toMatch(/^https:\/\/www\.tiktok\.com\/@kansascitychiefsfan5\/video\/7334621391758642478/);
    expect(a.author.handle).toBe("kansascitychiefsfan5");
    expect(a.author.displayName).toBe("Peter Griffin, fan");
    expect(a.stats).toEqual({ views: 31677, likes: 355, comments: 5, shares: 22 });
    expect(a.durationSec).toBe(84);
    expect(a.music).toEqual({ title: "Yeah! (feat. Lil Jon & Ludacris)", author: "Usher" });
    expect(a.postedAt).toBe("2024-02-12T07:58:02.000Z");
    expect(a.hashtags).toEqual(["superbowlhalftime", "SuperBowl", "traviskelce", "kansascitychiefs"]);
  });

  it("coerces numeric strings and drops non-numeric ones", () => {
    const b = videos[1];
    expect(b.stats.views).toBe(1500);
    expect(b.stats.likes).toBeUndefined();
    expect(b.postedAt).toBe(new Date(1707724000 * 1000).toISOString());
    expect(b.url).toBe("https://www.tiktok.com/@synthetic_user/video/7000000000000000222");
  });

  it("extracts the cursor as a string", () => {
    expect(tiktokNextCursor(keyword)).toBe("12");
  });
});

describe("mapTikTokHashtag (doc fixture)", () => {
  const videos = mapTikTokHashtag(hashtag);

  it("maps ids, stats, thumbnail and cursor", () => {
    expect(videos.map((v) => v.id)).toEqual(["6862153058223197445", "6862153058223197999"]);
    expect(videos[0].stats).toEqual({ views: 852942803, likes: 68933772, comments: 2901351, shares: 42457977 });
    expect(videos[0].thumbnailUrl).toMatch(/^https:\/\/p16-sign-va\.tiktokcdn\.com\//);
    expect(videos[0].durationSec).toBe(11);
    expect(tiktokNextCursor(hashtag)).toBe("20");
  });

  it("returns no cursor when has_more is 0 or the cursor is missing", () => {
    expect(tiktokNextCursor({ cursor: 40, has_more: 0 })).toBeUndefined();
    expect(tiktokNextCursor({})).toBeUndefined();
    expect(tiktokNextCursor(null)).toBeUndefined();
  });
});

describe("TikTok mappers on garbage input", () => {
  it.each(GARBAGE)("returns [] for %j without throwing", (raw) => {
    expect(mapTikTokTrending(raw)).toEqual([]);
    expect(mapTikTokKeyword(raw)).toEqual([]);
    expect(mapTikTokHashtag(raw)).toEqual([]);
  });

  it("ignores unsafe URLs and wrong types inside an item", () => {
    const [v] = mapTikTokTrending({
      aweme_list: [
        {
          aweme_id: 123,
          url: "javascript:alert(1)",
          desc: { not: "a string" },
          author: "nope",
          statistics: { play_count: -5, digg_count: Infinity },
          video: { cover: { url_list: ["data:image/png;base64,AAA"] } },
        },
      ],
    });
    expect(v.id).toBe("123");
    expect(v.url).toBe("https://www.tiktok.com/video/123");
    expect(v.thumbnailUrl).toBeNull();
    expect(v.caption).toBe("");
    expect(v.stats.views).toBeUndefined();
    expect(v.stats.likes).toBeUndefined();
  });
});
