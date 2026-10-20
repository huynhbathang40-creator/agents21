import type { Video } from "../../shared/types";

export const SORT_KEYS = ["views", "likes", "comments", "engagement", "newest"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  views: "Most viewed",
  likes: "Most liked",
  comments: "Most commented",
  engagement: "Engagement rate",
  newest: "Newest",
};

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

function finite(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * (likes + comments + shares) / views. Missing likes/comments/shares count as 0.
 * Undefined when views is missing or 0, or when none of the numerators are known.
 */
export function engagementRate(video: Pick<Video, "stats">): number | undefined {
  const { likes, comments, shares } = video.stats;
  const views = finite(video.stats.views);
  if (views === undefined || views <= 0) return undefined;
  const parts = [finite(likes), finite(comments), finite(shares)];
  if (parts.every((p) => p === undefined)) return undefined;
  return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0) / views;
}

export function sortValue(video: Video, key: SortKey): number | undefined {
  switch (key) {
    case "views":
      return finite(video.stats.views);
    case "likes":
      return finite(video.stats.likes);
    case "comments":
      return finite(video.stats.comments);
    case "engagement":
      return engagementRate(video);
    case "newest": {
      if (!video.postedAt) return undefined;
      const t = Date.parse(video.postedAt);
      return Number.isNaN(t) ? undefined : t;
    }
  }
}

/**
 * Returns a new array sorted descending by `key`. Pure and stable: ties keep
 * their original order. Items with a missing value always go last (in their
 * original relative order).
 */
export function sortVideos(videos: readonly Video[], key: SortKey): Video[] {
  return videos
    .map((video, index) => ({ video, index, value: sortValue(video, key) }))
    .sort((a, b) => {
      if (a.value === undefined && b.value === undefined) return a.index - b.index;
      if (a.value === undefined) return 1;
      if (b.value === undefined) return -1;
      if (b.value !== a.value) return b.value - a.value;
      return a.index - b.index;
    })
    .map((entry) => entry.video);
}
