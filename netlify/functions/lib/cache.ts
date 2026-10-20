// Response cache in the Netlify Blobs store `trend-cache` (PRD §9.3).
// Entries are `{ expiresAt, payload }`; expired entries are ignored (and overwritten on the next miss).
// If Blobs is unavailable (no Netlify context, network error, …) every call degrades to a miss / no-op,
// so the API keeps working without a cache.
import { createHash } from "node:crypto";
import { getStore, type Store } from "@netlify/blobs";
import type { Platform } from "../../../shared/types";

export const CACHE_STORE = "trend-cache";
export const DEFAULT_TTL_TRENDING_SEC = 900;
export const DEFAULT_TTL_SEARCH_SEC = 600;

interface CacheEntry<T> {
  expiresAt: number;
  payload: T;
}

function envSeconds(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const trendingTtlSec = () => envSeconds("CACHE_TTL_TRENDING_SEC", DEFAULT_TTL_TRENDING_SEC);
export const searchTtlSec = () => envSeconds("CACHE_TTL_SEARCH_SEC", DEFAULT_TTL_SEARCH_SEC);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Trending is cached per platform+region. Only TikTok's feed is regional, so others share one entry. */
export function trendingCacheKey(platform: Platform, region: string): string {
  const r = platform === "tiktok" ? region.trim().toUpperCase() : "-";
  return `trending/${platform}/${r}`;
}

/**
 * Search is cached per platform + mode + normalized query + cursor, so a partial failure still
 * lets the good platforms be reused. Hashed to keep keys short and free of user-controlled characters.
 */
export function searchCacheKey(platform: Platform, mode: "keyword" | "hashtag", q: string, cursor?: string): string {
  const normQ = q.trim().replace(/\s+/g, " ").toLowerCase();
  return `search/${platform}/${sha256(JSON.stringify([mode, normQ, cursor ?? ""]))}`;
}

function store(): Store | undefined {
  try {
    return getStore(CACHE_STORE);
  } catch {
    return undefined; // no Blobs context (local tests, misconfigured site)
  }
}

export async function cacheGet<T>(key: string, now = Date.now()): Promise<T | undefined> {
  try {
    const entry = (await store()?.get(key, { type: "json" })) as CacheEntry<T> | null | undefined;
    if (!entry || typeof entry !== "object" || typeof entry.expiresAt !== "number") return undefined;
    if (entry.expiresAt <= now) return undefined;
    return entry.payload;
  } catch {
    return undefined;
  }
}

export async function cacheSet<T>(key: string, payload: T, ttlSec: number, now = Date.now()): Promise<void> {
  try {
    const entry: CacheEntry<T> = { expiresAt: now + ttlSec * 1000, payload };
    await store()?.setJSON(key, entry);
  } catch {
    // Degrade silently: a failed cache write must never fail the request.
  }
}
