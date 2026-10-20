// YouTube connector. Param names verified against docs.scrapecreators.com (see mappers/youtube.ts).
// Cost: 1 credit per call.
import { scGet } from "../scrapeCreators";
import { mapYouTubeHashtag, mapYouTubeKeyword, mapYouTubeTrending, youtubeNextCursor } from "../mappers/youtube";
import { normalizeHashtag } from "../mappers/util";
import type { ConnectorResult, SearchOptions, TrendingOptions } from "./types";

/** /v1/youtube/shorts/trending takes no params; `region` is ignored. */
export async function trending(opts: TrendingOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet("/v1/youtube/shorts/trending", {}, { signal: opts.signal });
  return { videos: mapYouTubeTrending(raw) };
}

export async function searchKeyword(query: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet(
    "/v1/youtube/search",
    { query: query.trim(), continuationToken: opts.cursor },
    { signal: opts.signal },
  );
  return { videos: mapYouTubeKeyword(raw), nextCursor: youtubeNextCursor(raw) };
}

export async function searchHashtag(tag: string, opts: SearchOptions = {}): Promise<ConnectorResult> {
  const raw = await scGet(
    "/v1/youtube/search/hashtag",
    { hashtag: normalizeHashtag(tag), continuationToken: opts.cursor },
    { signal: opts.signal },
  );
  return { videos: mapYouTubeHashtag(raw), nextCursor: youtubeNextCursor(raw) };
}
