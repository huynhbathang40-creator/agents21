// Instagram connector. Param names verified against docs.scrapecreators.com (see mappers/instagram.ts).
// Cost: 1 credit per call.
import { scGet } from "../scrapeCreators";
import {
  instagramHashtagNextCursor,
  instagramKeywordNextCursor,
  mapInstagramHashtag,
  mapInstagramKeyword,
  mapInstagramTrending,
} from "../mappers/instagram";
import { normalizeHashtag } from "../mappers/util";
import type { ConnectorResult, SearchOptions, TrendingOptions } from "./types";

/** /v1/instagram/reels/trending takes no params; `region` is ignored. */
export async function trending(opts: TrendingOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet("/v1/instagram/reels/trending", {}, { signal: opts.signal });
  return { videos: mapInstagramTrending(raw) };
}

/** /v2/instagram/reels/search paginates with `page`; our cursor is that page number. */
export async function searchKeyword(query: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet("/v2/instagram/reels/search", { query: query.trim(), page: opts.cursor }, { signal: opts.signal });
  const videos = mapInstagramKeyword(raw);
  return { videos, nextCursor: instagramKeywordNextCursor(videos.length, opts.cursor) };
}

export async function searchHashtag(tag: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet(
    "/v1/instagram/search/hashtag",
    { hashtag: normalizeHashtag(tag), cursor: opts.cursor },
    { signal: opts.signal },
  );
  return { videos: mapInstagramHashtag(raw), nextCursor: instagramHashtagNextCursor(raw) };
}
