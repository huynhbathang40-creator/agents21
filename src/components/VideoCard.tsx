import { useState, type ReactNode } from "react";
import type { Video } from "../../shared/types";
import { compactNumber, formatDuration, relativeDate, truncate } from "../lib/format";
import { PLATFORM_BADGE_CLASSES, PLATFORM_LABELS } from "../lib/platforms";
import { safeHttpUrl } from "../lib/url";
import { FOCUS_RING } from "./focus";

interface Props {
  video: Video;
  /** Injected for deterministic rendering; defaults to Date.now() at render. */
  now?: number;
}

function statPhrase(value: number | undefined, noun: string): string | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : `${compactNumber(value)} ${noun}`;
}

/** Accessible name for the whole-card link: concise, includes the key facts. */
export function cardLabel(video: Video, now: number = Date.now()): string {
  const platform = PLATFORM_LABELS[video.platform] ?? video.platform;
  const caption = video.caption ? truncate(video.caption, 120) : "Untitled video";
  const stats = [
    statPhrase(video.stats.views, "views"),
    statPhrase(video.stats.likes, "likes"),
    statPhrase(video.stats.comments, "comments"),
  ].filter(Boolean);
  const posted = relativeDate(video.postedAt, now);
  const duration = formatDuration(video.durationSec);
  const parts = [
    `${platform} video by @${video.author.handle}: ${caption}`,
    stats.length ? stats.join(", ") : undefined,
    duration ? `duration ${duration}` : undefined,
    posted ? `posted ${posted}` : undefined,
    "opens in a new tab",
  ].filter(Boolean);
  return `${parts.join(". ")}.`;
}

function Thumbnail({ video }: { video: Video }) {
  const src = safeHttpUrl(video.thumbnailUrl);
  const [failed, setFailed] = useState(false);
  const alt = video.caption ? truncate(video.caption, 120) : `Video by @${video.author.handle}`;

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-700 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200">
        <span className="text-sm font-medium">
          {PLATFORM_LABELS[video.platform] ?? "Video"} · No preview
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

function Avatar({ video }: { video: Video }) {
  const src = safeHttpUrl(video.author.avatarUrl);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-xs font-semibold uppercase text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
      >
        {video.author.handle.charAt(0) || "?"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 rounded-full object-cover"
    />
  );
}

/** Compact stat. Missing values are hidden rather than shown as 0. */
function Stat({ value, noun, icon }: { value: number | undefined; noun: string; icon: ReactNode }) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const label = `${compactNumber(value)} ${noun}`;
  return (
    <span role="img" className="inline-flex items-center gap-1" aria-label={label} title={label}>
      <span aria-hidden="true">{icon}</span>
      <span aria-hidden="true">{compactNumber(value)}</span>
    </span>
  );
}

const ICON_CLASS = "h-4 w-4";
const EyeIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON_CLASS}>
    <path d="M10 4C5.5 4 2 8.5 1.2 9.6a.7.7 0 0 0 0 .8C2 11.5 5.5 16 10 16s8-4.5 8.8-5.6a.7.7 0 0 0 0-.8C18 8.5 14.5 4 10 4Zm0 9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
  </svg>
);
const HeartIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON_CLASS}>
    <path d="M10 17.5 8.8 16.4C4.5 12.5 1.7 10 1.7 6.9A4.4 4.4 0 0 1 6.1 2.5c1.5 0 2.9.7 3.9 1.8a5.2 5.2 0 0 1 3.9-1.8 4.4 4.4 0 0 1 4.4 4.4c0 3.1-2.8 5.6-7.1 9.5L10 17.5Z" />
  </svg>
);
const CommentIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON_CLASS}>
    <path d="M3 3h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8l-4 3.5V14H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
  </svg>
);

export function VideoCard({ video, now = Date.now() }: Props) {
  const href = safeHttpUrl(video.url);
  const duration = formatDuration(video.durationSec);
  const posted = relativeDate(video.postedAt, now);
  const platformLabel = PLATFORM_LABELS[video.platform] ?? video.platform;

  const body = (
    <>
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <Thumbnail video={video} />
        <span
          className={`absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-semibold ${PLATFORM_BADGE_CLASSES[video.platform] ?? "bg-neutral-900 text-white"}`}
        >
          {platformLabel}
        </span>
        {duration && (
          <span
            role="img"
            className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white"
            aria-label={`Duration ${duration}`}
          >
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar video={video} />
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            @{video.author.handle}
          </span>
        </div>
        {/* Caption is rendered as plain text (React escapes it); never as HTML. */}
        <p className="line-clamp-2 break-words text-sm text-neutral-700 dark:text-neutral-300">
          {video.caption || <span className="italic">No caption</span>}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
          <Stat value={video.stats.views} noun="views" icon={EyeIcon} />
          <Stat value={video.stats.likes} noun="likes" icon={HeartIcon} />
          <Stat value={video.stats.comments} noun="comments" icon={CommentIcon} />
          {posted && video.postedAt && (
            <time dateTime={video.postedAt} title={new Date(video.postedAt).toLocaleString()} className="ml-auto whitespace-nowrap">
              {posted}
            </time>
          )}
        </div>
      </div>
    </>
  );

  const cardClass =
    "group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  if (!href) {
    // No safe URL to open: render as a non-interactive card.
    return <article className={cardClass}>{body}</article>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={cardLabel(video, now)}
      className={`${cardClass} transition-shadow hover:shadow-md ${FOCUS_RING}`}
    >
      {body}
    </a>
  );
}
