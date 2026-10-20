// Per-IP fixed-window rate limit (PRD §9.3): RATE_LIMIT_PER_MIN requests per minute (default 30).
//
// Storage: Netlify Blobs store `rate-limit`, one key per (hashed) IP holding `{ bucket, count }`
// where bucket = floor(now / 60 s). A new minute simply overwrites the entry, so keys don't pile up
// one per minute. The IP is SHA-256 hashed so raw addresses are never stored.
//
// Caveats (documented on purpose):
// - FAIL OPEN: if Blobs is unavailable or errors, the request is allowed. Availability of the app
//   wins over strict limiting; the upstream credit spend is still bounded by the response cache.
// - Read-then-write is not atomic, so concurrent requests from one IP can under-count slightly.
//   Strong consistency is requested to keep this window small. Good enough for abuse damping,
//   not a hard quota.
import { createHash } from "node:crypto";
import { getStore, type Store } from "@netlify/blobs";

export const RATE_LIMIT_STORE = "rate-limit";
export const DEFAULT_RATE_LIMIT_PER_MIN = 30;
const WINDOW_MS = 60_000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

interface Entry {
  bucket: number;
  count: number;
}

export function rateLimitPerMinute(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MIN);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_RATE_LIMIT_PER_MIN;
}

/** Netlify's client IP header first, then the first X-Forwarded-For entry, else "unknown". */
export function clientIp(req: Request): string {
  const nf = req.headers.get("x-nf-client-connection-ip")?.trim();
  if (nf) return nf;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || "unknown";
}

function store(): Store | undefined {
  try {
    return getStore({ name: RATE_LIMIT_STORE, consistency: "strong" });
  } catch {
    return undefined;
  }
}

export async function checkRateLimit(
  req: Request,
  opts: { limit?: number; now?: number } = {},
): Promise<RateLimitResult> {
  const limit = opts.limit ?? rateLimitPerMinute();
  const now = opts.now ?? Date.now();
  const bucket = Math.floor(now / WINDOW_MS);
  const key = `ip/${createHash("sha256").update(clientIp(req)).digest("hex")}`;

  try {
    const s = store();
    if (!s) return { allowed: true }; // fail open
    const prev = (await s.get(key, { type: "json" })) as Entry | null;
    const count = prev && prev.bucket === bucket && typeof prev.count === "number" ? prev.count : 0;
    if (count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil(((bucket + 1) * WINDOW_MS - now) / 1000));
      return { allowed: false, retryAfterSec };
    }
    await s.setJSON(key, { bucket, count: count + 1 } satisfies Entry);
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}
