import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_STATE,
  parsePlatformList,
  parseSearchState,
  parseViewState,
  serializeSearchState,
  serializeTrendingState,
  serializeViewState,
} from "./viewState";

describe("parseViewState", () => {
  it("returns defaults for an empty query", () => {
    expect(parseViewState("")).toEqual(DEFAULT_VIEW_STATE);
    expect(DEFAULT_VIEW_STATE).toEqual({ platform: "tiktok", region: "US", sort: "views" });
  });

  it("parses valid values, case-insensitively", () => {
    expect(parseViewState("?platform=YouTube&region=gb&sort=Engagement")).toEqual({
      platform: "youtube",
      region: "GB",
      sort: "engagement",
    });
  });

  it("falls back to defaults per invalid field", () => {
    expect(parseViewState("?platform=myspace&region=ZZ&sort=newest")).toEqual({
      platform: "tiktok",
      region: "US",
      sort: "newest",
    });
    expect(parseViewState("?platform=instagram&region=<script>&sort=")).toEqual({
      platform: "instagram",
      region: "US",
      sort: "views",
    });
  });
});

describe("serializeViewState", () => {
  it("writes platform, region and sort", () => {
    expect(serializeViewState({ platform: "instagram", region: "JP", sort: "likes" })).toBe(
      "platform=instagram&region=JP&sort=likes",
    );
  });

  it("preserves unrelated params and overwrites stale ones", () => {
    const out = new URLSearchParams(
      serializeViewState({ platform: "youtube", region: "US", sort: "newest" }, "?utm=x&sort=bogus"),
    );
    expect(out.get("utm")).toBe("x");
    expect(out.get("sort")).toBe("newest");
    expect(out.get("platform")).toBe("youtube");
  });

  it("round-trips through parse", () => {
    const state = { platform: "youtube", region: "BR", sort: "comments" } as const;
    expect(parseViewState(serializeViewState(state))).toEqual(state);
  });
});

describe("parseSearchState", () => {
  it("returns null without a usable q (→ trending view)", () => {
    expect(parseSearchState("")).toBeNull();
    expect(parseSearchState("?q=")).toBeNull();
    expect(parseSearchState("?q=%20%20")).toBeNull();
    expect(parseSearchState("?q=%23%23")).toBeNull();
    expect(parseSearchState("?platform=youtube&sort=likes")).toBeNull();
  });

  it("parses q, platforms and sort", () => {
    expect(parseSearchState("?q=%23fitness&platforms=youtube,tiktok&sort=likes")).toEqual({
      q: "#fitness",
      platforms: ["tiktok", "youtube"],
      sort: "likes",
    });
  });

  it("defaults to all platforms and views sort", () => {
    expect(parseSearchState("?q=cats")).toEqual({ q: "cats", platforms: ["tiktok", "instagram", "youtube"], sort: "views" });
  });

  it("validates: trims/collapses q, caps at 100, drops unknown platforms, dedupes, rejects bad sort", () => {
    const long = "a".repeat(150);
    expect(parseSearchState(`?q=${long}`)?.q).toHaveLength(100);
    expect(parseSearchState("?q=%20cat%20%20videos%20")?.q).toBe("cat videos");
    expect(parseSearchState("?q=x&platforms=MySpace,YouTube,youtube,%20instagram")?.platforms).toEqual([
      "instagram",
      "youtube",
    ]);
    expect(parseSearchState("?q=x&platforms=myspace,,")?.platforms).toEqual(["tiktok", "instagram", "youtube"]);
    expect(parseSearchState("?q=x&sort=<script>")?.sort).toBe("views");
  });
});

describe("serializeSearchState", () => {
  it("writes q and sort, omitting platforms when all are selected", () => {
    expect(serializeSearchState({ q: "#fitness", platforms: ["youtube", "instagram", "tiktok"], sort: "views" })).toBe(
      "q=%23fitness&sort=views",
    );
  });

  it("writes platforms as readable csv in canonical order", () => {
    expect(serializeSearchState({ q: "cat videos", platforms: ["youtube", "tiktok"], sort: "newest" })).toBe(
      "q=cat+videos&platforms=tiktok,youtube&sort=newest",
    );
  });

  it("drops trending-only params and stale search params, keeps unrelated ones", () => {
    const out = new URLSearchParams(
      serializeSearchState(
        { q: "dogs", platforms: ["instagram"], sort: "likes" },
        "?utm=x&platform=youtube&region=GB&q=old&platforms=tiktok&sort=views",
      ),
    );
    expect(out.get("utm")).toBe("x");
    expect(out.has("platform")).toBe(false);
    expect(out.has("region")).toBe(false);
    expect(out.get("q")).toBe("dogs");
    expect(out.get("platforms")).toBe("instagram");
    expect(out.get("sort")).toBe("likes");
  });

  it("round-trips through parse", () => {
    const state = { q: "#travel vlog", platforms: ["tiktok", "instagram"], sort: "engagement" } as const;
    expect(parseSearchState(serializeSearchState({ ...state, platforms: [...state.platforms] }))).toEqual(state);
  });
});

describe("serializeTrendingState", () => {
  it("removes q and platforms and writes trending params", () => {
    const out = serializeTrendingState(
      { platform: "youtube", region: "US", sort: "likes" },
      "?q=%23fitness&platforms=tiktok&sort=views&utm=x",
    );
    expect(parseSearchState(out)).toBeNull();
    expect(new URLSearchParams(out).get("utm")).toBe("x");
    expect(parseViewState(out)).toEqual({ platform: "youtube", region: "US", sort: "likes" });
  });
});

describe("parsePlatformList", () => {
  it("handles null, junk and valid lists", () => {
    expect(parsePlatformList(null)).toEqual(["tiktok", "instagram", "youtube"]);
    expect(parsePlatformList("youtube")).toEqual(["youtube"]);
  });
});
