import type { Video } from "../../../../shared/types";
import { arrayAt, extractHashtags, firstString, firstUrl, get, isObj, mapItems, str, toIsoDate, toNumber } from "./util";

/*
 * TikTok mappers. All three endpoints return the standard TikTok "aweme" item.
 * Docs read via Firecrawl on 2026-10-20:
 *
 * GET /v1/tiktok/get-trending-feed  https://docs.scrapecreators.com/v1/tiktok/get-trending-feed
 *   Query: region (required, 2-letter), trim (opt). Response: { success, credits_*, aweme_list[] }. No cursor.
 *   Doc example lacks video.duration, music.*; author.unique_id not always present (handle falls back to url).
 *
 * GET /v1/tiktok/search/keyword  https://docs.scrapecreators.com/v1/tiktok/search/keyword
 *   Query: query (required), date_posted, sort_by, region, cursor, trim.
 *   Response: { success, credits_*, cursor, search_item_list[] }.
 *   ASSUMED: each search_item_list entry may wrap the aweme in `aweme_info` (both shapes handled).
 *
 * GET /v1/tiktok/search/hashtag  https://docs.scrapecreators.com/v1/tiktok/search/hashtag
 *   Query: hashtag (required, without '#'), region, cursor, trim.
 *   Response: { success, credits_*, aweme_list[], cursor, has_more, ... }.
 *
 * Item paths used (confirmed in doc examples): aweme_id, desc, create_time (unix s), url,
 * author.{unique_id,nickname,avatar_thumb.url_list[0]}, statistics.{play,digg,comment,share}_count,
 * video.cover.url_list[0], video.duration (ms; search examples), music.{title,author} (search examples).
 * Assumed fallbacks: share_url, create_time_utc, video.origin_cover, text_extra[].hashtag_name.
 */

export function mapTikTokItem(raw: unknown): Video | undefined {
  // Keyword search may wrap the aweme in `aweme_info`.
  const item = isObj(get(raw, "aweme_info")) ? get(raw, "aweme_info") : raw;
  if (!isObj(item)) return undefined;
  const id = firstString(item.aweme_id, item.id);
  if (!id) return undefined;

  const rawUrl = firstUrl(item.url, item.share_url, get(item, "share_info", "share_url"));
  const handle =
    firstString(get(item, "author", "unique_id")) ?? (rawUrl ? /tiktok\.com\/@([^/?#]+)/.exec(rawUrl)?.[1] : undefined) ?? "";
  const caption = str(item.desc) ?? "";

  const url =
    rawUrl ??
    (handle
      ? `https://www.tiktok.com/@${encodeURIComponent(handle)}/video/${encodeURIComponent(id)}`
      : `https://www.tiktok.com/video/${encodeURIComponent(id)}`);

  const thumbnailUrl =
    firstUrl(
      get(item, "video", "cover", "url_list", 0),
      get(item, "video", "origin_cover", "url_list", 0),
      get(item, "video", "dynamic_cover", "url_list", 0),
      get(item, "image_post_info", "images", 0, "display_image", "url_list", 0),
    ) ?? null;

  const textExtra = get(item, "text_extra");
  const tagsFromExtra = Array.isArray(textExtra)
    ? [...new Set(textExtra.map((t) => str(get(t, "hashtag_name"))).filter((t): t is string => !!t))]
    : [];
  const hashtags = tagsFromExtra.length > 0 ? tagsFromExtra : extractHashtags(caption);

  const musicTitle = str(get(item, "music", "title"));
  const musicAuthor = str(get(item, "music", "author"));

  return {
    id,
    platform: "tiktok",
    url,
    thumbnailUrl,
    caption,
    author: {
      handle,
      displayName: str(get(item, "author", "nickname")),
      avatarUrl: firstUrl(
        get(item, "author", "avatar_thumb", "url_list", 0),
        get(item, "author", "avatar_medium", "url_list", 0),
        get(item, "author", "avatar_larger", "url_list", 0),
      ),
      url: handle ? `https://www.tiktok.com/@${encodeURIComponent(handle)}` : undefined,
    },
    stats: {
      views: toNumber(get(item, "statistics", "play_count")),
      likes: toNumber(get(item, "statistics", "digg_count")),
      comments: toNumber(get(item, "statistics", "comment_count")),
      shares: toNumber(get(item, "statistics", "share_count")),
    },
    postedAt: toIsoDate(item.create_time) ?? toIsoDate(item.create_time_utc),
    durationSec: tiktokDurationSec(get(item, "video", "duration") ?? item.duration),
    hashtags,
    music: musicTitle || musicAuthor ? { title: musicTitle, author: musicAuthor } : undefined,
  };
}

/**
 * The doc examples give video.duration in ms (83851, 10703). Some payloads use seconds,
 * so values < 1000 are treated as seconds.
 */
function tiktokDurationSec(v: unknown): number | undefined {
  const n = toNumber(v);
  if (n === undefined || n === 0) return undefined;
  return n >= 1000 ? Math.round(n / 1000) : Math.round(n);
}

export function mapTikTokTrending(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "aweme_list"), mapTikTokItem);
}

export function mapTikTokKeyword(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "search_item_list", "aweme_list"), mapTikTokItem);
}

export function mapTikTokHashtag(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "aweme_list"), mapTikTokItem);
}

/** Next-page cursor for the search endpoints: top-level `cursor`, unless `has_more` is explicitly falsy. */
export function tiktokNextCursor(raw: unknown): string | undefined {
  const hasMore = get(raw, "has_more");
  if (hasMore === false || hasMore === 0) return undefined;
  return str(get(raw, "cursor"));
}
