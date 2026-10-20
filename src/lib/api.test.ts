import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResponse } from "../../shared/types";
import {
  ApiError,
  PASSWORD_HEADER,
  PasswordRequiredError,
  RateLimitedError,
  errorMessageFromBody,
  fetchHealth,
  fetchTrending,
  parseRetryAfter,
  searchUrl,
  searchVideos,
  shouldRetry,
} from "./api";
import { clearPassword, getPassword, setPassword } from "./password";

const okBody: SearchResponse = { results: [], errors: [], cursors: {}, cached: false };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const fetchMock = vi.fn<typeof fetch>();

function lastRequest(): { url: string; headers: Record<string, string> } {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), headers: (init?.headers ?? {}) as Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearPassword();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearPassword();
});

describe("fetchTrending", () => {
  it("calls our own route with platform and region and returns the response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...okBody, cached: true }));
    const res = await fetchTrending("tiktok", "GB");
    expect(lastRequest().url).toBe("/api/trending?platform=tiktok&region=GB");
    expect(res.cached).toBe(true);
  });

  it("omits region when undefined", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await fetchTrending("youtube", undefined);
    expect(lastRequest().url).toBe("/api/trending?platform=youtube");
  });

  it("does not send the password header when none is stored", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await fetchTrending("tiktok", "US");
    expect(lastRequest().headers[PASSWORD_HEADER]).toBeUndefined();
  });

  it("sends x-app-password when a password is stored", async () => {
    setPassword("hunter2");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await fetchTrending("tiktok", "US");
    expect(lastRequest().headers[PASSWORD_HEADER]).toBe("hunter2");
    expect(lastRequest().url).not.toContain("hunter2");
  });

  it("maps 401 without a password to PasswordRequiredError (not incorrect)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Password required" }));
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PasswordRequiredError);
    expect((err as PasswordRequiredError).incorrect).toBe(false);
    expect((err as PasswordRequiredError).status).toBe(401);
  });

  it("maps 401 with a password to an incorrect PasswordRequiredError and clears it", async () => {
    setPassword("wrong");
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Password required" }));
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PasswordRequiredError);
    expect((err as PasswordRequiredError).incorrect).toBe(true);
    expect((err as Error).message).toBe("Incorrect password");
    expect(getPassword()).toBeUndefined();
  });

  it("maps 429 to RateLimitedError with Retry-After seconds", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: "Too many requests. Please slow down." }, { "Retry-After": "42" }));
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterSec).toBe(42);
    expect((err as Error).message).toBe("Too many requests, try again in 42 seconds.");
  });

  it.each([
    [400, "region must be a 2-letter country code"],
    [502, "All platforms are temporarily unavailable"],
    [503, "Service temporarily unavailable"],
  ])("maps %d to ApiError with the body's error message", async (status, message) => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(status, { error: message, errors: [{ platform: "tiktok", message: "TikTok is temporarily unavailable" }] }),
    );
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(PasswordRequiredError);
    expect((err as ApiError).status).toBe(status);
    expect((err as Error).message).toBe(message);
  });

  it("uses a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 500 }));
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect((err as Error).message).toBe("Service temporarily unavailable. Please try again later.");
  });

  it("maps network failures to a friendly ApiError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = await fetchTrending("tiktok", "US").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
  });

  it("rejects malformed 200 bodies", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { nope: true }));
    await expect(fetchTrending("tiktok", "US")).rejects.toBeInstanceOf(ApiError);
  });

  it("fills in missing optional fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results: [] }));
    expect(await fetchTrending("instagram", undefined)).toEqual(okBody);
  });
});

describe("fetchHealth", () => {
  it("returns the health body", async () => {
    const body = { status: "ok", apiKeyConfigured: false, passwordProtected: true, time: "2026-10-20T00:00:00Z" };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, body));
    expect(await fetchHealth()).toEqual(body);
    expect(lastRequest().url).toBe("/api/health");
  });
});

describe("parseRetryAfter", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfter("17")).toBe(17);
    expect(parseRetryAfter("0")).toBe(1);
  });

  it("parses HTTP dates", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(parseRetryAfter("Tue, 20 Oct 2026 12:00:30 GMT", now)).toBe(30);
  });

  it("falls back to 60 seconds", () => {
    expect(parseRetryAfter(null)).toBe(60);
    expect(parseRetryAfter("soon")).toBe(60);
  });
});

describe("errorMessageFromBody", () => {
  it("never surfaces credit details for 402", () => {
    expect(errorMessageFromBody({ error: "out of credits" }, 402)).toBe(
      "Service temporarily unavailable. Please try again later.",
    );
  });

  it("falls back to errors[0].message", () => {
    expect(errorMessageFromBody({ errors: [{ platform: "youtube", message: "YouTube down" }] }, 502)).toBe("YouTube down");
  });
});

describe("shouldRetry", () => {
  it("never retries auth, rate-limit or 4xx errors", () => {
    expect(shouldRetry(0, new PasswordRequiredError(false))).toBe(false);
    expect(shouldRetry(0, new RateLimitedError(5))).toBe(false);
    expect(shouldRetry(0, new ApiError("bad", 400))).toBe(false);
  });

  it("retries other errors once", () => {
    expect(shouldRetry(0, new ApiError("down", 502))).toBe(true);
    expect(shouldRetry(1, new ApiError("down", 502))).toBe(false);
  });
});

describe("searchVideos", () => {
  function sentParams(): URLSearchParams {
    const url = lastRequest().url;
    expect(url.startsWith("/api/search?")).toBe(true);
    return new URL(url, "http://localhost").searchParams;
  }

  it("omits platforms when all are requested and encodes the hashtag", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await searchVideos("#fitness", ["youtube", "tiktok", "instagram"]);
    expect(lastRequest().url).toBe("/api/search?q=%23fitness");
  });

  it("sends a canonical platforms csv for a subset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await searchVideos("cat videos", ["youtube", "tiktok"]);
    const params = sentParams();
    expect(params.get("q")).toBe("cat videos");
    expect(params.get("platforms")).toBe("tiktok,youtube");
    expect([...params.keys()].some((k) => k.startsWith("cursor."))).toBe(false);
  });

  it("adds cursor.<platform> only for requested platforms with a cursor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await searchVideos("dogs", ["instagram", "youtube"], { instagram: "ig-2", youtube: "yt=2&x", tiktok: "tt-2" });
    const params = sentParams();
    expect(params.get("platforms")).toBe("instagram,youtube");
    expect(params.get("cursor.instagram")).toBe("ig-2");
    expect(params.get("cursor.youtube")).toBe("yt=2&x");
    expect(params.has("cursor.tiktok")).toBe(false);
  });

  it("sends cursors with platforms omitted when all three page", () => {
    const url = searchUrl("x", ["tiktok", "instagram", "youtube"], { tiktok: "a", instagram: "b", youtube: "c" });
    expect(url).toBe("/api/search?q=x&cursor.tiktok=a&cursor.instagram=b&cursor.youtube=c");
  });

  it("sends the password header and maps 401/429 like trending", async () => {
    setPassword("pw");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okBody));
    await searchVideos("x", ["tiktok"]);
    expect(lastRequest().headers[PASSWORD_HEADER]).toBe("pw");

    clearPassword();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Password required" }));
    expect(await searchVideos("x", ["tiktok"]).catch((e: unknown) => e)).toBeInstanceOf(PasswordRequiredError);

    fetchMock.mockResolvedValueOnce(jsonResponse(429, {}, { "Retry-After": "5" }));
    const err = await searchVideos("x", ["tiktok"]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterSec).toBe(5);
  });

  it("normalizes a partial response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results: [], cursors: { tiktok: "n" } }));
    const res = await searchVideos("x", ["tiktok"]);
    expect(res).toEqual({ results: [], errors: [], cursors: { tiktok: "n" }, cached: false });
  });
});
