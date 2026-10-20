import { describe, expect, it } from "vitest";
import trending from "../__fixtures__/youtube-trending.json";
import keyword from "../__fixtures__/youtube-keyword.json";
import hashtag from "../__fixtures__/youtube-hashtag.json";
import { mapYouTubeHashtag, mapYouTubeKeyword, mapYouTubeTrending, youtubeNextCursor } from "./youtube";

const GARBAGE: unknown[] = [null, undefined, 42, "str", [], {}, { shorts: "x" }, { videos: [null, 1], shelves: [null, { items: 5 }] }];

describe("mapYouTubeTrending (doc fixture)", () => {
  const videos = mapYouTubeTrending(trending);

  it("maps ids, url, thumbnail and author", () => {
    expect(videos.map((v) => v.id)).toEqual(["ou0nl5ET0HA", "RHjn1eyPLgI", "SYNTH000003"]);
    const [a] = videos;
    expect(a.platform).toBe("youtube");
    expect(a.url).toBe("https://www.youtube.com/watch?v=ou0nl5ET0HA");
    expect(a.thumbnailUrl).toBe("https://img.youtube.com/vi/ou0nl5ET0HA/maxresdefault.jpg");
    expect(a.caption).toBe("That hooper who says their just shoes");
    expect(a.author).toEqual({
      handle: "dameuniverse",
      displayName: "Dame Universe",
      avatarUrl: undefined,
      url: "https://www.youtube.com/@dameuniverse",
    });
  });

  it("maps stats as numbers, postedAt as ISO, durationMs to seconds", () => {
    const [a, b] = videos;
    expect(a.stats).toEqual({ views: 13798774, likes: 151957, comments: 168, shares: undefined });
    expect(a.postedAt).toBe("2025-08-07T20:00:22.000Z");
    expect(a.durationSec).toBe(19);
    expect(a.hashtags).toBeUndefined();
    expect(b.stats.likes).toBeUndefined(); // likeCountInt: null and no text
    expect(b.hashtags).toEqual(["discipline", "success", "mindset", "ego", "shorts", "fyp", "edit", "motivation"]);
  });

  it("leaves missing fields undefined and builds a url from the id", () => {
    const c = videos[2];
    expect(c.url).toBe("https://www.youtube.com/watch?v=SYNTH000003");
    expect(c.thumbnailUrl).toBeNull();
    expect(c.caption).toBe("");
    expect(c.author).toEqual({ handle: "", displayName: undefined, avatarUrl: undefined, url: undefined });
    expect(c.stats.views).toBe(1234);
    expect(c.postedAt).toBeUndefined();
    expect(c.durationSec).toBeUndefined();
  });

  it("has no cursor", () => {
    expect(youtubeNextCursor(trending)).toBeUndefined();
  });
});

describe("mapYouTubeKeyword (doc fixture)", () => {
  const videos = mapYouTubeKeyword(keyword);

  it("merges videos, shorts and shelf items; skips channels", () => {
    expect(videos.map((v) => v.id)).toEqual(["BzSzwqb-OEE", "uMNvF-lSCHg", "LLBR5nO05tE"]);
  });

  it("handles a 'channel/<id>' handle by using the title and a /channel/ url", () => {
    const [a] = videos;
    expect(a.author.handle).toBe("NFrealmusic");
    expect(a.author.url).toBe("https://www.youtube.com/channel/UCoRR6OLuIZ2-5VxtnQIaN2w");
    expect(a.author.avatarUrl).toMatch(/^https:\/\/yt3\.ggpht\.com\//);
    expect(a.stats.views).toBe(14860541);
    expect(a.postedAt).toBe("2023-05-28T17:08:46.499Z");
    expect(a.durationSec).toBe(254);
  });

  it("maps shorts and parses compact counts on shelf items", () => {
    const [, short, shelf] = videos;
    expect(short.author.url).toBe("https://www.youtube.com/@abbyandryan");
    expect(short.durationSec).toBe(44);
    expect(short.hashtags).toEqual(["run", "runvlog", "runner", "shorts", "morning"]);
    expect(shelf.stats.views).toBe(750000);
    expect(shelf.author.handle).toBe("");
  });

  it("extracts continuationToken", () => {
    expect(youtubeNextCursor(keyword)).toBe("EooDEg...");
  });
});

describe("mapYouTubeHashtag (doc fixture)", () => {
  it("maps the doc item, skips the item without id, returns the cursor", () => {
    const videos = mapYouTubeHashtag(hashtag);
    expect(videos.map((v) => v.id)).toEqual(["jXMISgQq9MM"]);
    expect(videos[0].author.handle).toBe("ZZang Funny");
    expect(videos[0].author.url).toBe("https://www.youtube.com/channel/UCvUzWu1Whyw1FWuLl9GOo_g");
    expect(videos[0].stats.views).toBe(22668056);
    expect(videos[0].hashtags).toEqual(["shorts", "funny", "fails"]);
    expect(youtubeNextCursor(hashtag)).toBe("4qmFsgLtBRIJRkVoYX....");
  });
});

describe("YouTube mappers on garbage input", () => {
  it.each(GARBAGE)("returns [] for %j without throwing", (raw) => {
    expect(mapYouTubeTrending(raw)).toEqual([]);
    expect(mapYouTubeKeyword(raw)).toEqual([]);
    expect(mapYouTubeHashtag(raw)).toEqual([]);
  });
});
