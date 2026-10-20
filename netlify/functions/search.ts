// GET /api/search?q=...&platforms=tiktok,youtube&cursor.tiktok=... → SearchResponse (PRD §6.2, §9.2).
// `#tag` → hashtag endpoints, anything else → keyword endpoints. Platforms are queried in parallel;
// one failing platform never fails the request (PRD §10).
// Routed by the /api/* redirect in netlify.toml; no per-function `config.path`.
// Cost: 1 credit per requested platform per cache miss (cached 10 min per platform+query+cursor).
import { PLATFORMS, type Platform } from "../../shared/types";
import { searchCacheKey, searchTtlSec } from "./lib/cache";
import { connectors } from "./lib/connectors";
import { guard } from "./lib/guard";
import { badRequest, platformResponse, runPlatform, type PlatformOutcome } from "./lib/http";

const MAX_Q_LENGTH = 100;
const MAX_CURSOR_LENGTH = 500;

type Mode = "keyword" | "hashtag";

interface ParsedSearch {
  mode: Mode;
  term: string;
  platforms: Platform[];
  cursors: Partial<Record<Platform, string>>;
}

function parse(params: URLSearchParams): ParsedSearch | string {
  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 1 || q.length > MAX_Q_LENGTH) return `q must be 1-${MAX_Q_LENGTH} characters`;

  let mode: Mode = "keyword";
  let term = q;
  if (q.startsWith("#")) {
    mode = "hashtag";
    term = q.replace(/^#+/, "").trim();
    if (!term) return "hashtag must not be empty";
  }

  const rawPlatforms = params.get("platforms");
  let platforms: Platform[];
  if (rawPlatforms === null || rawPlatforms.trim() === "") {
    platforms = [...PLATFORMS];
  } else {
    const parts = rawPlatforms.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return "platforms must not be empty";
    for (const p of parts) {
      if (!(PLATFORMS as readonly string[]).includes(p)) return `platforms must be from: ${PLATFORMS.join(", ")}`;
    }
    platforms = [...new Set(parts)] as Platform[];
  }

  const cursors: Partial<Record<Platform, string>> = {};
  for (const p of platforms) {
    const c = params.get(`cursor.${p}`)?.trim();
    if (!c) continue;
    if (c.length > MAX_CURSOR_LENGTH) return `cursor.${p} is too long`;
    cursors[p] = c;
  }

  return { mode, term, platforms, cursors };
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const parsed = parse(new URL(req.url).searchParams);
  if (typeof parsed === "string") return badRequest(parsed);
  const { mode, term, platforms, cursors } = parsed;
  const ttl = searchTtlSec();

  const settled = await Promise.allSettled(
    platforms.map((p) =>
      runPlatform(p, searchCacheKey(p, mode, term, cursors[p]), ttl, () => {
        const opts = { cursor: cursors[p], signal: req.signal };
        return mode === "hashtag" ? connectors[p].searchHashtag(term, opts) : connectors[p].searchKeyword(term, opts);
      }),
    ),
  );
  // runPlatform never rejects, but stay defensive: a rejection counts as an upstream failure.
  const outcomes: PlatformOutcome[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : { platform: platforms[i], ok: false, kind: "upstream" },
  );
  return platformResponse(outcomes);
}
