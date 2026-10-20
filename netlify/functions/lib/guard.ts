// Common front door for gated API handlers: method → password → rate limit.
// Returns a Response to send immediately, or null to continue to validation.
import { isAuthorized } from "./auth";
import { json, methodNotAllowed } from "./http";
import { checkRateLimit } from "./rateLimit";

function tooMany(retryAfterSec: number): Response {
  return json(429, { error: "Too many requests. Please slow down." }, { "Retry-After": String(retryAfterSec) });
}

export async function guard(req: Request): Promise<Response | null> {
  if (req.method !== "GET") return methodNotAllowed("GET");

  if (!isAuthorized(req)) {
    // Failed attempts still count toward the per-IP limit so the password can't be brute-forced
    // at unlimited speed. Callers over the limit get 429 instead of 401.
    const rl = await checkRateLimit(req);
    if (!rl.allowed) return tooMany(rl.retryAfterSec);
    return json(401, { error: "Password required" });
  }

  const rl = await checkRateLimit(req);
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  return null;
}
