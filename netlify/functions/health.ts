// GET /api/health — reports whether the backend is running and configured.
// Routed by the /api/* redirect in netlify.toml; no per-function `config.path`,
// so there is exactly one routing rule for every function.
// Only booleans are returned: never the key or password values.
import type { HealthResponse } from "../../shared/types";

// netlify.toml [[headers]] only cover static files, so functions set their own.
const baseHeaders = { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };

const isSet =(value: string | undefined) => typeof value === "string" && value.trim().length > 0;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...baseHeaders, "Cache-Control": "no-store", Allow: "GET" },
    });
  }

  const body: HealthResponse = {
    status: "ok",
    apiKeyConfigured: isSet(process.env.SCRAPECREATORS_API_KEY),
    passwordProtected: isSet(process.env.APP_PASSWORD),
    time: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...baseHeaders, "Cache-Control": "no-store" },
  });
}
