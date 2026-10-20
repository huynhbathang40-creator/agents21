// Pure helpers for the search view: query normalization, paging cursors, page merging, summaries.
import { PLATFORMS, type Platform, type PlatformError, type SearchResponse, type Video } from "../../shared/types";
import { PLATFORM_LABELS } from "./platforms";

export const MAX_QUERY_LENGTH = 100;
export const SUGGESTED_HASHTAGS = ["#fyp", "#fitness", "#recipe", "#travel", "#music"] as const;

/**
 * Trim, collapse whitespace and cap at 100 chars (server rules). Returns undefined for an empty
 * query or one made only of '#' characters (the server would reject it as an empty hashtag).
 */
export function normalizeQuery(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const q = raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH).trim();
  if (!q || /^#+$/.test(q)) return undefined;
  return q;
}

export function isHashtagQuery(raw: string): boolean {
  return raw.trimStart().startsWith("#");
}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Dedupe and put platforms in canonical order (tiktok, instagram, youtube). */
export function orderPlatforms(list: readonly Platform[]): Platform[] {
  return PLATFORMS.filter((p) => list.includes(p));
}

export function isAllPlatforms(list: readonly Platform[]): boolean {
  return PLATFORMS.every((p) => list.includes(p));
}

/** What one /api/search request asks for: which platforms, and the cursor for each (if any). */
export interface SearchPageParam {
  platforms: Platform[];
  cursors: Partial<Record<Platform, string>>;
}

export function firstPageParam(platforms: readonly Platform[]): SearchPageParam {
  return { platforms: orderPlatforms(platforms), cursors: {} };
}

/**
 * Next page: only platforms that were requested and returned a non-empty cursor.
 * Undefined when there is nothing more to load.
 */
export function nextPageParam(lastPage: SearchResponse, requested: readonly Platform[]): SearchPageParam | undefined {
  const cursors: Partial<Record<Platform, string>> = {};
  for (const p of orderPlatforms(requested)) {
    const c = lastPage.cursors?.[p];
    if (typeof c === "string" && c.trim()) cursors[p] = c;
  }
  const platforms = orderPlatforms(Object.keys(cursors) as Platform[]);
  return platforms.length ? { platforms, cursors } : undefined;
}

export function videoKey(video: Pick<Video, "platform" | "id">): string {
  return `${video.platform}:${video.id}`;
}

/** Concatenate pages in order, dropping repeat videos (platform+id; first wins) and repeat errors. */
export function mergePages(pages: readonly SearchResponse[]): { results: Video[]; errors: PlatformError[] } {
  const seen = new Set<string>();
  const results: Video[] = [];
  const errorPlatforms = new Set<Platform>();
  const errors: PlatformError[] = [];
  for (const page of pages) {
    for (const video of page.results) {
      const key = videoKey(video);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(video);
    }
    for (const err of page.errors) {
      if (errorPlatforms.has(err.platform)) continue;
      errorPlatforms.add(err.platform);
      errors.push(err);
    }
  }
  return { results, errors };
}

export function resultCountLabel(count: number): string {
  return `${count} ${count === 1 ? "result" : "results"}`;
}

/** "#fitness · TikTok, YouTube · 57 results" (PRD §11). Count omitted when undefined. */
export function searchSummary(q: string, platforms: readonly Platform[], count?: number): string {
  const parts = [q, orderPlatforms(platforms).map((p) => PLATFORM_LABELS[p]).join(", ")];
  if (count !== undefined) parts.push(resultCountLabel(count));
  return parts.join(" · ");
}

export function documentTitle(part?: string): string {
  return part ? `${part} — TrendScope` : "TrendScope";
}
