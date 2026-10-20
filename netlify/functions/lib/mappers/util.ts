// Defensive helpers shared by the per-platform mappers. They never throw on
// bad input and return `undefined` when a value is missing or unusable.

export type Obj = Record<string, unknown>;

export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Safe path lookup: get(raw, "author", "avatar_thumb", "url_list", 0). */
export function get(v: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = v;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[key];
    } else {
      if (!isObj(cur)) return undefined;
      cur = cur[key];
    }
  }
  return cur;
}

/** Non-empty trimmed string, or undefined. Finite numbers are stringified (ids, cursors). */
export function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const s = v.trim();
    return s.length > 0 ? s : undefined;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "bigint") return v.toString();
  return undefined;
}

/** First candidate that is a non-empty string (per `str`). */
export function firstString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const s = str(c);
    if (s !== undefined) return s;
  }
  return undefined;
}

/** Finite non-negative number from a number or numeric string ("1,234" ok), else undefined. */
export function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Parses display counts such as "13,798,774 views", "750K", "1.5M views".
 * Use only as a fallback when the platform gives no integer field.
 */
export function parseCountText(v: unknown): number | undefined {
  const direct = toNumber(v);
  if (direct !== undefined) return direct;
  const s = str(v);
  if (!s) return undefined;
  const m = /^([\d.,]+)\s*([KMB])?\b/i.exec(s);
  if (!m) return undefined;
  const base = toNumber(m[1]);
  if (base === undefined) return undefined;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Math.round(base * mult);
}

/** ISO 8601 from unix seconds, unix milliseconds, or a parseable date string. */
export function toIsoDate(v: unknown): string | undefined {
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return undefined;
    const ms = v < 1e12 ? v * 1000 : v; // seconds vs milliseconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const s = str(v);
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return toIsoDate(Number(s));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Only http(s) URLs pass, so javascript:/data: URLs never reach the client. */
export function httpUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? s : undefined;
  } catch {
    return undefined;
  }
}

/** First valid http(s) URL among the candidates. */
export function firstUrl(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const u = httpUrl(c);
    if (u) return u;
  }
  return undefined;
}

/** Unique hashtags (without '#') from free text, in order of appearance; undefined if none. */
export function extractHashtags(...texts: (string | undefined)[]): string[] | undefined {
  const tags = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) tags.add(m[1]);
  }
  return tags.size > 0 ? [...tags] : undefined;
}

/** The array found at the first matching key (or raw itself if it is an array), else []. */
export function arrayAt(raw: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  for (const k of keys) {
    const v = get(raw, k);
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** Maps each item, dropping those the item mapper rejects and duplicate ids. Never throws. */
export function mapItems<T extends { id: string }>(items: unknown[], mapItem: (item: unknown) => T | undefined): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let v: T | undefined;
    try {
      v = mapItem(item);
    } catch {
      v = undefined; // a single malformed item must never fail the whole page
    }
    if (v && !seen.has(v.id)) {
      seen.add(v.id);
      out.push(v);
    }
  }
  return out;
}

/** Strips one or more leading '#' and surrounding whitespace from hashtag input. */
export function normalizeHashtag(tag: string): string {
  return tag.trim().replace(/^#+/, "").trim();
}
