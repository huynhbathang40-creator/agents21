import { PLATFORMS, type Platform } from "../../shared/types";
import { isRegion, type Region } from "./platforms";
import { isSortKey, type SortKey } from "./sort";

export interface ViewState {
  platform: Platform;
  region: Region;
  sort: SortKey;
}

export const DEFAULT_VIEW_STATE: ViewState = { platform: "tiktok", region: "US", sort: "views" };

function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

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
