import { describe, expect, it } from "vitest";
import type { Video } from "../../shared/types";
import { cardLabel } from "./VideoCard";

const now = Date.parse("2026-10-20T12:00:00Z");
const base: Video = {
  id: "1",
  platform: "youtube",
  url: "https://www.youtube.com/shorts/1",
  thumbnailUrl: null,
  caption: "Hello <b>world</b>",
  author: { handle: "creator" },
  stats: { views: 1_250_000, likes: 34_000 },
  postedAt: "2026-10-17T12:00:00Z",
  durationSec: 42,
};

describe("cardLabel", () => {
  it("summarises the card and omits missing stats", () => {
    expect(cardLabel(base, now)).toBe(
      "YouTube video by @creator: Hello <b>world</b>. 1.3M views, 34K likes. duration 0:42. posted 3d ago. opens in a new tab.",
    );
  });

  it("handles an empty caption and no stats", () => {
    const label = cardLabel({ ...base, caption: "", stats: {}, postedAt: undefined, durationSec: undefined }, now);
    expect(label).toBe("YouTube video by @creator: Untitled video. opens in a new tab.");
  });
});
