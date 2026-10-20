// TikTok connector. Param names verified against docs.scrapecreators.com (see mappers/tiktok.ts).
// Cost: 1 credit per call.
import { scGet } from "../scrapeCreators";
import { mapTikTokHashtag, mapTikTokKeyword, mapTikTokTrending, tiktokNextCursor } from "../mappers/tiktok";
import { normalizeHashtag } from "../mappers/util";
import type { ConnectorResult, SearchOptions, TrendingOptions } from "./types";

/** `region` is required by /v1/tiktok/get-trending-feed. */
export const TIKTOK_DEFAULT_REGION = "US";

export async function trending(opts: TrendingOptions = {}): Promise<ConnectorResult> {
  const region = opts.region?.trim().toUpperCase() || TIKTOK_DEFAULT_REGION;
  const raw = await scGet("/v1/tiktok/get-trending-feed", { region }, { signal: opts.signal });
  return { videos: mapTikTokTrending(raw) }; // trending feed has no cursor
}

export async function searchKeyword(query: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet("/v1/tiktok/search/keyword", { query: query.trim(), cursor: opts.cursor }, { signal: opts.signal });
  return { videos: mapTikTokKeyword(raw), nextCursor: tiktokNextCursor(raw) };
}

export async function searchHashtag(tag: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet(
    "/v1/tiktok/search/hashtag",
    { hashtag: normalizeHashtag(tag), cursor: opts.cursor },
    { signal: opts.signal },
  );
  return { videos: mapTikTokHashtag(raw), nextCursor: tiktokNextCursor(raw) };
}
