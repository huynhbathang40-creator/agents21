import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW_STATE, parseViewState, serializeViewState } from "./viewState";

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
