// Client for our own /api routes only. Never talks to the upstream provider directly.
import type { HealthResponse, Platform, SearchResponse } from "../../shared/types";
import { clearPassword, getPassword } from "./password";
import { isAllPlatforms, orderPlatforms } from "./search";

export const PASSWORD_HEADER = "x-app-password";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 401: the app is password protected. `incorrect` is true when a password was sent and rejected. */
export class PasswordRequiredError extends ApiError {
  readonly incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? "Incorrect password" : "This app is password protected", 401);
    this.name = "PasswordRequiredError";
    this.incorrect = incorrect;
  }
}

/** 429: per-IP rate limit. `retryAfterSec` comes from the Retry-After header. */
export class RateLimitedError extends ApiError {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(rateLimitMessage(retryAfterSec), 429);
    this.name = "RateLimitedError";
    this.retryAfterSec = retryAfterSec;
  }
}

const DEFAULT_RETRY_AFTER_SEC = 60;
const GENERIC_ERROR = "Something went wrong while loading videos. Please try again.";
const UNAVAILABLE = "Service temporarily unavailable. Please try again later.";

export function rateLimitMessage(seconds: number): string {
  return `Too many requests, try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
}

/** Retry-After is either delta-seconds or an HTTP date. Falls back to 60s when absent/invalid. */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number {
  if (!header) return DEFAULT_RETRY_AFTER_SEC;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Math.max(1, Number(trimmed));
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.max(1, Math.ceil((date - now) / 1000));
  return DEFAULT_RETRY_AFTER_SEC;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Human-readable message from an error body: `error`, then errors[0].message, then a generic one. */
export function errorMessageFromBody(body: unknown, status: number): string {
  // PRD §8: never surface credit/billing details.
  if (status === 402) return UNAVAILABLE;
  if (isRecord(body)) {
    if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
    const errors = body.errors;
    if (Array.isArray(errors) && isRecord(errors[0]) && typeof errors[0].message === "string") {
      const msg = errors[0].message.trim();
      if (msg) return msg;
    }
  }
  return status >= 500 ? UNAVAILABLE : GENERIC_ERROR;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** GET a JSON /api route, attaching the stored app password and mapping errors to typed classes. */
export async function apiGet(path: string, signal?: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const password = getPassword();
  if (password) headers[PASSWORD_HEADER] = password;

  let res: Response;
  try {
    res = await fetch(path, { headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  if (res.status === 401) {
    if (password) clearPassword();
    throw new PasswordRequiredError(Boolean(password));
  }
  if (res.status === 429) throw new RateLimitedError(parseRetryAfter(res.headers.get("Retry-After")));

  const body = await readJson(res);
  if (!res.ok) throw new ApiError(errorMessageFromBody(body, res.status), res.status);
  return body;
}

function normalizeResponse(body: unknown): SearchResponse {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new ApiError("Received an unexpected response from the server.", 200);
  }
  return {
    results: body.results as SearchResponse["results"],
    errors: Array.isArray(body.errors) ? (body.errors as SearchResponse["errors"]) : [],
    cursors: isRecord(body.cursors) ? (body.cursors as SearchResponse["cursors"]) : {},
    cached: body.cached === true,
  };
}

/** `region` is omitted when undefined (the server defaults it; only TikTok uses it). */
export async function fetchTrending(
  platform: Platform,
  region: string | undefined,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ platform });
  if (region) params.set("region", region);
  return normalizeResponse(await apiGet(`/api/trending?${params.toString()}`, signal));
}

/**
 * GET /api/search. `platforms` is omitted when all are requested (server default);
 * `cursor.<platform>` is sent for each requested platform that has a cursor.
 */
export function searchUrl(q: string, platforms: readonly Platform[], cursors: Partial<Record<Platform, string>> = {}): string {
  const params = new URLSearchParams({ q });
  const list = orderPlatforms(platforms);
  if (list.length && !isAllPlatforms(list)) params.set("platforms", list.join(","));
  for (const p of list) {
    const cursor = cursors[p];
    if (cursor) params.set(`cursor.${p}`, cursor);
  }
  return `/api/search?${params.toString()}`;
}

export async function searchVideos(
  q: string,
  platforms: readonly Platform[],
  cursors: Partial<Record<Platform, string>> = {},
  signal?: AbortSignal,
): Promise<SearchResponse> {
  return normalizeResponse(await apiGet(searchUrl(q, platforms, cursors), signal));
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const body = await apiGet("/api/health", signal);
  if (!isRecord(body) || typeof body.apiKeyConfigured !== "boolean") {
    throw new ApiError("Received an unexpected response from the server.", 200);
  }
  return body as unknown as HealthResponse;
}

/** TanStack Query retry policy: never auto-retry auth or rate-limit errors; retry others once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof PasswordRequiredError || error instanceof RateLimitedError) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}
