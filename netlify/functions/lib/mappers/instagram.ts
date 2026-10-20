import type { Video } from "../../../../shared/types";
import { arrayAt, extractHashtags, firstString, firstUrl, get, isObj, mapItems, str, toIsoDate, toNumber } from "./util";

/*
 * Instagram mappers. Docs read via Firecrawl on 2026-10-20:
 *
 * GET /v1/instagram/reels/trending  https://docs.scrapecreators.com/v1/instagram/reels/trending
 *   No query params. Response: { success, credits_*, reels[] }. No cursor.
 *   Item: id, pk, shortcode, url, caption (string), taken_at (ISO), image_url,
 *   image_versions2.candidates[0].url, like_count, comment_count, play_count, ig_play_count,
 *   user.{username,full_name,profile_pic_url}, clips_metadata.{music_info,original_sound_info}.
 *
 * GET /v2/instagram/reels/search  https://docs.scrapecreators.com/v2/instagram/reels/search
 *   Query: query (required), date_posted, page (number). Response: { success, credits_*, reels[] }.
 *   No cursor in the response: the next cursor is page+1 while results are non-empty.
 *   Item: id, shortcode, url, caption, taken_at, thumbnail_src, display_url, video_duration (s),
 *   like_count, comment_count, owner.{username,full_name,profile_pic_url},
 *   clips_music_attribution_info.{song_name,artist_name}. No view count.
 *
 * GET /v1/instagram/search/hashtag  https://docs.scrapecreators.com/v1/instagram/search/hashtag
 *   Query: hashtag (required), date_posted, media_type (all|reels), cursor (Google page, max 11).
 *   Response: { success, credits_*, hashtag, media_type, posts[], cursor }. Item shape = reels/search.
 *
 * No endpoint documents a share count, so stats.shares stays undefined unless share_count appears.
 */

export function mapInstagramItem(item: unknown): Video | undefined {
  if (!isObj(item)) return undefined;
  const id = firstString(item.id, item.pk);
  if (!id) return undefined;

  const shortcode = firstString(item.shortcode, item.code);
  const url = firstUrl(item.url) ?? (shortcode ? `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/` : undefined);
  if (!url) return undefined; // nothing to link to

  const user = isObj(item.user) ? item.user : isObj(item.owner) ? item.owner : undefined;
  const handle = str(user?.username) ?? "";
  const caption = firstString(item.caption, get(item, "caption", "text")) ?? "";

  return {
    id,
    platform: "instagram",
    url,
    thumbnailUrl:
      firstUrl(
        item.image_url,
        item.thumbnail_src,
        item.display_url,
        get(item, "image_versions2", "candidates", 0, "url"),
        item.thumbnail_url,
      ) ?? null,
    caption,
    author: {
      handle,
      displayName: str(user?.full_name),
      avatarUrl: firstUrl(user?.profile_pic_url),
      url: handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : undefined,
    },
    stats: {
      views: toNumber(item.play_count) ?? toNumber(item.ig_play_count) ?? toNumber(item.video_play_count) ?? toNumber(item.video_view_count),
      likes: toNumber(item.like_count),
      comments: toNumber(item.comment_count),
      shares: toNumber(item.share_count),
    },
    postedAt: toIsoDate(item.taken_at),
    durationSec: toNumber(item.video_duration),
    hashtags: extractHashtags(caption),
    music: instagramMusic(item),
  };
}

function instagramMusic(item: Record<string, unknown>): Video["music"] {
  const candidates: [unknown, unknown][] = [
    [get(item, "clips_music_attribution_info", "song_name"), get(item, "clips_music_attribution_info", "artist_name")],
    [
      get(item, "clips_metadata", "music_info", "music_asset_info", "title"),
      get(item, "clips_metadata", "music_info", "music_asset_info", "display_artist"),
    ],
    [
      get(item, "clips_metadata", "original_sound_info", "original_audio_title"),
      get(item, "clips_metadata", "original_sound_info", "ig_artist", "username"),
    ],
  ];
  for (const [t, a] of candidates) {
    const title = str(t);
    const author = str(a);
    if (title || author) return { title, author };
  }
  return undefined;
}

export function mapInstagramTrending(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "reels"), mapInstagramItem);
}

export function mapInstagramKeyword(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "reels"), mapInstagramItem);
}

export function mapInstagramHashtag(raw: unknown): Video[] {
  return mapItems(arrayAt(raw, "posts", "reels"), mapInstagramItem);
}

/** /v1/instagram/search/hashtag returns a top-level `cursor`. Docs: cursor > 11 is a 400, so stop there. */
export function instagramHashtagNextCursor(raw: unknown): string | undefined {
  const c = str(get(raw, "cursor"));
  if (!c) return undefined;
  const n = toNumber(c);
  return n !== undefined && n > 11 ? undefined : c;
}

/** /v2/instagram/reels/search paginates by `page`; there is no response cursor. */
export function instagramKeywordNextCursor(resultCount: number, currentPage: string | undefined): string | undefined {
  if (resultCount <= 0) return undefined;
  const page = toNumber(currentPage) ?? 1;
  return String(Math.floor(page) + 1);
}
