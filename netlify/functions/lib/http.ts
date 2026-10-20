// Shared HTTP helpers for /api/trending and /api/search (PRD §9.2, §10).
// - Every response is JSON with nosniff (netlify.toml [[headers]] don't apply to functions).
// - Upstream failures are mapped to user-safe messages; raw upstream messages and the key never
//   reach a response body. Server logs carry only kind/status/path.
import type { Platform, PlatformError, SearchResponse, Video } from "../../../shared/types";
import { cacheGet, cacheSet } from "./cache";
import type { ConnectorResult } from "./connectors";
import { ScrapeCreatorsError, type ScrapeCreatorsErrorKind } from "./scrapeCreators";

export const BASE_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  // Responses vary by caller (optional password gate), so no shared/CDN caching.
  "Cache-Control": "private, no-store",
} as const;

export function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extraHeaders } });
}

export const badRequest = (error: string) => json(400, { error });

export function methodNotAllowed(allow = "GET"): Response {
  return json(405, { error: "Method not allowed" }, { Allow: allow });
}

export const PLATFORM_LABELS: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

/** The only per-platform error text a user ever sees. */
export function safePlatformMessage(platform: Platform): string {
  return `${PLATFORM_LABELS[platform]} is temporarily unavailable`;
}

/** Account-wide problems (key/credits): surfaced as a generic 503, never described. */
const SERVICE_KINDS: ReadonlySet<ScrapeCreatorsErrorKind> = new Set(["missing_key", "unauthorized", "out_of_credits"]);

export function errorKind(err: unknown): ScrapeCreatorsErrorKind {
  return err instanceof ScrapeCreatorsError ? err.kind : "upstream";
}

/** Logs kind/status/path only. ScrapeCreatorsError messages start with "GET /path" (no query, no key). */
export function logPlatformError(platform: Platform, err: unknown): void {
  const kind = errorKind(err);
  const status = err instanceof ScrapeCreatorsError ? err.status : undefined;
  const path = err instanceof ScrapeCreatorsError ? /^GET (\/[^\s?]*)/.exec(err.message)?.[1] : undefined;
  console.error(`[trendscope] platform=${platform} kind=${kind} status=${status ?? "-"} path=${path ?? "-"}`);
}

export type PlatformOutcome =
  | { platform: Platform; ok: true; result: ConnectorResult; cached: boolean }
  | { platform: Platform; ok: false; kind: ScrapeCreatorsErrorKind };

/**
 * Runs one platform call through the cache. Only successful results are cached.
 * Upstream 404 (not_found) becomes an empty, uncached success.
 */
export async function runPlatform(
  platform: Platform,
  cacheKey: string,
  ttlSec: number,
  call: () => Promise<ConnectorResult>,
): Promise<PlatformOutcome> {
  const hit = await cacheGet<ConnectorResult>(cacheKey);
  if (hit && Array.isArray(hit.videos)) return { platform, ok: true, result: hit, cached: true };
  try {
    const result = await call();
    await cacheSet(cacheKey, result, ttlSec);
    return { platform, ok: true, result, cached: false };
  } catch (err) {
    const kind = errorKind(err);
    if (kind === "not_found") return { platform, ok: true, result: { videos: [] }, cached: false };
    logPlatformError(platform, err);
    return { platform, ok: false, kind };
  }
}

/** Round-robin interleave across platforms (in request order), deduped by platform+id. */
export function interleave(lists: Video[][]): Video[] {
  const out: Video[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      const v = list[i];
      if (!v) continue;
      const key = `${v.platform}:${v.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Builds the SearchResponse and status:
 * - all requested platforms failed: any key/credit problem → 503 (generic), all upstream 400 → 400, else 502
 * - partial or full success → 200 with errors[] for the failed platforms
 */
export function platformResponse(outcomes: PlatformOutcome[]): Response {
  const errors: PlatformError[] = [];
  const lists: Video[][] = [];
  const cursors: SearchResponse["cursors"] = {};
  const failedKinds: ScrapeCreatorsErrorKind[] = [];

  for (const o of outcomes) {
    if (o.ok) {
      lists.push(o.result.videos);
      if (o.result.nextCursor) cursors[o.platform] = o.result.nextCursor;
    } else {
      failedKinds.push(o.kind);
      errors.push({ platform: o.platform, message: safePlatformMessage(o.platform) });
    }
  }

  if (outcomes.length > 0 && failedKinds.length === outcomes.length) {
    if (failedKinds.some((k) => SERVICE_KINDS.has(k))) {
      return json(503, { error: "Service temporarily unavailable", errors });
    }
    if (failedKinds.every((k) => k === "bad_request")) {
      return json(400, { error: "The request could not be processed", errors });
    }
    return json(502, { error: "All platforms are temporarily unavailable", errors });
  }

  const body: SearchResponse = {
    results: interleave(lists),
    errors,
    cursors,
    cached: outcomes.length > 0 && outcomes.every((o) => o.ok && o.cached),
  };
  return json(200, body);
}
