// Minimal Scrape Creators HTTP client (server-side only).
// Auth: `x-api-key` header from process.env.SCRAPECREATORS_API_KEY (PRD §8, §9.4).
// The key is never logged, never placed in an error message, and never returned.

export const SC_BASE_URL = "https://api.scrapecreators.com";
export const SC_DEFAULT_TIMEOUT_MS = 15_000;

export type ScrapeCreatorsErrorKind =
  | "missing_key"
  | "bad_request" // 400
  | "unauthorized" // 401
  | "out_of_credits" // 402
  | "forbidden" // 403
  | "not_found" // 404
  | "upstream" // 5xx, other non-2xx, invalid JSON, or 200 with success:false
  | "timeout"
  | "network";

export class ScrapeCreatorsError extends Error {
  readonly kind: ScrapeCreatorsErrorKind;
  readonly status?: number;

  constructor(kind: ScrapeCreatorsErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ScrapeCreatorsError";
    this.kind = kind;
    this.status = status;
  }
}

export type ScParams = Record<string, string | number | boolean | undefined | null>;

export interface ScGetOptions {
  /** Caller cancellation (e.g. the incoming request was aborted). */
  signal?: AbortSignal;
  /** Per-call timeout; defaults to 15 s. */
  timeoutMs?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export function statusToKind(status: number): ScrapeCreatorsErrorKind {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 402:
      return "out_of_credits";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    default:
      return "upstream";
  }
}

/** Builds the upstream URL. Only relative API paths are allowed so the key can't be sent to another host. */
export function buildScUrl(path: string, params: ScParams = {}): URL {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ScrapeCreatorsError("bad_request", "Invalid Scrape Creators path");
  }
  const url = new URL(path, SC_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url;
}

/**
 * GET an endpoint and return the parsed JSON body.
 * Throws ScrapeCreatorsError for every failure mode; never resolves with an error payload.
 */
export async function scGet(path: string, params: ScParams = {}, options: ScGetOptions = {}): Promise<unknown> {
  const { signal, timeoutMs = SC_DEFAULT_TIMEOUT_MS, fetchImpl } = options;
  const apiKey = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (!apiKey) {
    throw new ScrapeCreatorsError("missing_key", "Scrape Creators API key is not configured");
  }

  const url = buildScUrl(path, params);
  const where = `GET ${url.pathname}`; // path only; query values could contain user input but never the key

  const timeoutCtrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutCtrl.abort();
  }, timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeoutCtrl.signal]) : timeoutCtrl.signal;

  const doFetch = fetchImpl ?? globalThis.fetch;
  let res: Response;
  try {
    res = await doFetch(url.toString(), {
      method: "GET",
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      signal: combined,
    });
  } catch {
    // The underlying error is deliberately dropped: its message is not under our control.
    if (timedOut) throw new ScrapeCreatorsError("timeout", `${where} timed out after ${timeoutMs} ms`);
    if (signal?.aborted) throw new ScrapeCreatorsError("network", `${where} was aborted`);
    throw new ScrapeCreatorsError("network", `${where} failed: network error`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const kind = statusToKind(res.status);
    throw new ScrapeCreatorsError(kind, `${where} failed: HTTP ${res.status} (${kind})`, res.status);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ScrapeCreatorsError("upstream", `${where} returned invalid JSON`, res.status);
  }

  // Every documented response carries `success: true`; treat an explicit false as an upstream failure.
  if (typeof body === "object" && body !== null && (body as { success?: unknown }).success === false) {
    throw new ScrapeCreatorsError("upstream", `${where} reported success: false`, res.status);
  }
  return body;
}
