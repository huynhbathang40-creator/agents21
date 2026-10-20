// Pure display formatters. No locale-sensitive APIs so output is deterministic in tests.

const TIERS = [
  { suffix: "", value: 1 },
  { suffix: "K", value: 1e3 },
  { suffix: "M", value: 1e6 },
  { suffix: "B", value: 1e9 },
] as const;

const MISSING = "–";

/**
 * Compact number formatting: 999 -> "999", 1_234 -> "1.2K", 34_000 -> "34K",
 * 1_250_000 -> "1.3M", 123_456 -> "123K". Missing / non-finite -> "–".
 * One decimal below 100 of a unit, whole numbers above; rolls over to the
 * next unit when rounding would produce 1000 (999_999 -> "1M").
 */
export function compactNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return MISSING;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  let i = 0;
  while (i < TIERS.length - 1 && abs >= TIERS[i + 1].value) i++;

  for (;;) {
    const tier = TIERS[i];
    const scaled = abs / tier.value;
    const rounded = i > 0 && scaled < 100 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
    if (rounded >= 1000 && i < TIERS.length - 1) {
      i++;
      continue;
    }
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return sign + text + tier.suffix;
  }
}

/** Seconds -> "m:ss" or "h:mm:ss". Returns "" for missing/invalid input. */
export function formatDuration(totalSec: number | undefined | null): string {
  if (totalSec === undefined || totalSec === null || !Number.isFinite(totalSec) || totalSec < 0) {
    return "";
  }
  const s = Math.floor(totalSec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * ISO date -> short relative string ("just now", "5m ago", "3h ago", "3d ago",
 * "2w ago", "4mo ago", "2y ago"). Future dates read as "just now".
 * Returns "" for missing/invalid input.
 */
export function relativeDate(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.floor((now - then) / 1000);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < MONTH) return `${Math.floor(diff / WEEK)}w ago`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo ago`;
  return `${Math.floor(diff / YEAR)}y ago`;
}

/** Truncate plain text to `max` characters, adding an ellipsis. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
