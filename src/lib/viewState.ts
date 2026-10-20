import { PLATFORMS, type Platform } from "../../shared/types";
import { isRegion, type Region } from "./platforms";
import { isAllPlatforms, isPlatform, normalizeQuery, orderPlatforms } from "./search";
import { isSortKey, type SortKey } from "./sort";

export interface ViewState {
  platform: Platform;
  region: Region;
  sort: SortKey;
}

export const DEFAULT_VIEW_STATE: ViewState = { platform: "tiktok", region: "US", sort: "views" };

/** Parse ?platform=&region=&sort= with validation; invalid values fall back to defaults. */
export function parseViewState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const platform = params.get("platform")?.toLowerCase();
  const region = params.get("region")?.toUpperCase();
  const sort = params.get("sort")?.toLowerCase();
  return {
    platform: isPlatform(platform) ? platform : DEFAULT_VIEW_STATE.platform,
    region: isRegion(region) ? region : DEFAULT_VIEW_STATE.region,
    sort: isSortKey(sort) ? sort : DEFAULT_VIEW_STATE.sort,
  };
}

/** Merge view state into an existing query string, preserving unrelated params. */
export function serializeViewState(state: ViewState, existingSearch = ""): string {
  const params = new URLSearchParams(existingSearch);
  params.set("platform", state.platform);
  params.set("region", state.region);
  params.set("sort", state.sort);
  return params.toString();
}

/** Search view URL state (FR-9): ?q=&platforms=&sort=. */
export interface SearchState {
  q: string;
  platforms: Platform[];
  sort: SortKey;
}

const TRENDING_KEYS = ["platform", "region"];
const SEARCH_KEYS = ["q", "platforms"];

/** Comma-separated platform list; unknown entries dropped; empty or all-invalid → all platforms. */
export function parsePlatformList(raw: string | null | undefined): Platform[] {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isPlatform);
  const ordered = orderPlatforms(parts);
  return ordered.length ? ordered : [...PLATFORMS];
}

/** Returns the search state when ?q= holds a valid query, otherwise null (→ trending view). */
export function parseSearchState(search: string): SearchState | null {
  const params = new URLSearchParams(search);
  const q = normalizeQuery(params.get("q"));
  if (!q) return null;
  const sort = params.get("sort")?.toLowerCase();
  return {
    q,
    platforms: parsePlatformList(params.get("platforms")),
    sort: isSortKey(sort) ? sort : DEFAULT_VIEW_STATE.sort,
  };
}

/** Commas are legal in a query string; keep the shared URL readable (platforms=tiktok,youtube). */
function finish(params: URLSearchParams): string {
  return params.toString().replace(/%2C/gi, ",");
}

/**
 * Serialize search state, preserving unrelated params and dropping trending-only ones.
 * `platforms` is omitted when every platform is selected.
 */
export function serializeSearchState(state: SearchState, existingSearch = ""): string {
  const params = new URLSearchParams(existingSearch);
  for (const key of [...TRENDING_KEYS, ...SEARCH_KEYS, "sort"]) params.delete(key);
  params.set("q", normalizeQuery(state.q) ?? "");
  const platforms = orderPlatforms(state.platforms);
  if (platforms.length && !isAllPlatforms(platforms)) params.set("platforms", platforms.join(","));
  params.set("sort", state.sort);
  return finish(params);
}

/** Query string for the trending view: removes search params, then writes trending state. */
export function serializeTrendingState(state: ViewState, existingSearch = ""): string {
  const params = new URLSearchParams(existingSearch);
  for (const key of SEARCH_KEYS) params.delete(key);
  return serializeViewState(state, params.toString());
}
