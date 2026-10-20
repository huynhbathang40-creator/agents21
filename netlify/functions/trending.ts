// GET /api/trending?platform=tiktok&region=US → SearchResponse (PRD §9.2).
// Routed by the /api/* redirect in netlify.toml; no per-function `config.path`.
// Cost: 1 credit per cache miss (cached 15 min per platform+region, CACHE_TTL_TRENDING_SEC).
import { PLATFORMS, type Platform } from "../../shared/types";
import { trendingCacheKey, trendingTtlSec } from "./lib/cache";
import { connectors } from "./lib/connectors";
import { guard } from "./lib/guard";
import { badRequest, platformResponse, runPlatform } from "./lib/http";

const REGION_RE = /^[A-Za-z]{2}$/;

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const params = new URL(req.url).searchParams;
  const platform = params.get("platform")?.trim().toLowerCase() ?? "";
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    return badRequest(`platform must be one of: ${PLATFORMS.join(", ")}`);
  }
  const rawRegion = params.get("region")?.trim();
  if (rawRegion !== undefined && rawRegion !== "" && !REGION_RE.test(rawRegion)) {
    return badRequest("region must be a 2-letter country code");
  }
  const region = rawRegion ? rawRegion.toUpperCase() : "US";
  const p = platform as Platform;

  const outcome = await runPlatform(p, trendingCacheKey(p, region), trendingTtlSec(), () =>
    connectors[p].trending({ region, signal: req.signal }),
  );
  return platformResponse([outcome]);
}
