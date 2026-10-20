import type { Video } from "../../../../shared/types";
import { arrayAt, extractHashtags, firstString, firstUrl, get, isObj, mapItems, parseCountText, str, toIsoDate, toNumber } from "./util";

/*
 * YouTube mappers. Docs read via Firecrawl on 2026-10-20:
 *
 * GET /v1/youtube/shorts/trending  https://docs.scrapecreators.com/v1/youtube/shorts/trending
 *   No query params. Response: { success, credits_*, shorts[] }. No cursor (each call returns new shorts).
 *   Item: id, url, thumbnail, title, description, viewCountInt, likeCountInt, commentCountInt,
 *   publishDate (ISO), channel.{id,url,handle,title}, durationMs, keywords. No channel.thumbnail.
 *
 * GET /v1/youtube/search  https://docs.scrapecreators.com/v1/youtube/search
 *   Query: query (required), uploadDate, sortBy, type, duration, region, continuationToken, includeExtras.
 *   Response: { videos[], shorts[], channels[], playlists[], shelves[{items[]}], lives[], continuationToken }.
 *   Item: type, id, url, title, thumbnail, channel.{id,title,handle,thumbnail}, viewCountText,
 *   viewCountInt, publishedTime (ISO), lengthSeconds. channel.handle may be "channel/<id>".
 *
 * GET /v1/youtube/search/hashtag  https://docs.scrapecreators.com/v1/youtube/search/hashtag
 *   Query: hashtag (required), continuationToken, type. Response: { videos[], continuationToken }.
 *   Item: same as search plus description.
 */

export function mapYouTubeItem(item: unknown): Video | undefined {
  if (!isObj(item)) return undefined;
  const id = firstString(item.id, item.videoId);
  if (!id) return undefined;
  const type = str(item.type);
  if (type && type !== "video" && type !== "short") return undefined; // channels, playlists, shelves

  const channel = isObj(item.channel) ? item.channel : undefined;
  const rawHandle = str(channel?.handle)?.replace(/^@/, "");
  const channelId = str(channel?.id);
  const isChannelPath = !!rawHandle && rawHandle.startsWith("channel/");
  const handle = (isChannelPath ? undefined : rawHandle) ?? str(channel?.title) ?? channelId ?? "";
  const authorUrl =
    firstUrl(channel?.url) ??
    (rawHandle && !isChannelPath
      ? `https://www.youtube.com/@${encodeURIComponent(rawHandle)}`
      : channelId
        ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
        : undefined);

  const title = str(item.title);
  const description = str(item.description);
  const durationMs = toNumber(item.durationMs);

  return {
    id,
    platform: "youtube",
    url: firstUrl(item.url) ?? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    thumbnailUrl: firstUrl(item.thumbnail, get(item, "thumbnails", 0, "url")) ?? null,
    caption: title ?? description ?? "",
    author: {
      handle,
      displayName: str(channel?.title),
      avatarUrl: firstUrl(channel?.thumbnail),
      url: authorUrl,
    },
    stats: {
      views: toNumber(item.viewCountInt) ?? parseCountText(item.viewCountText),
      likes: toNumber(item.likeCountInt) ?? parseCountText(item.likeCountText),
      comments: toNumber(item.commentCountInt) ?? parseCountText(item.commentCountText),
      shares: undefined, // not provided by any of these endpoints
    },
    postedAt: toIsoDate(item.publishDate) ?? toIsoDate(item.publishedTime),
    durationSec: durationMs !== undefined ? Math.round(durationMs / 1000) || undefined : toNumber(item.lengthSeconds),
    hashtags: extractHashtags(title, description),
    music: undefined,
  };
}

export function mapYouTubeTrending(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "shorts"), mapYouTubeItem);
}

/** Merges videos, shorts and shelf items (shelf items carry less data, so they come last). */
export function mapYouTubeKeyword(raw: unknown): Video[] {
  const shelfItems = arrayAt(raw, "shelves").flatMap((s) => arrayAt(get(s, "items")));
  return mapItems([...arrayAt(raw, "videos"), ...arrayAt(raw, "shorts"), ...shelfItems], mapYouTubeItem);
}

export function mapYouTubeHashtag(raw: unknown): Video[] {
  return mapItems([...arrayAt(raw, "videos"), ...arrayAt(raw, "shorts")], mapYouTubeItem);
}

export function youtubeNextCursor(raw: unknown): string | undefined {
  return str(get(raw, "continuationToken"));
}
