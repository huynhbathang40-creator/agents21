import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildScUrl, scGet, ScrapeCreatorsError, type ScrapeCreatorsErrorKind } from "./scrapeCreators";

const KEY = "sk_test_SECRET_KEY_123";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function catchErr(p: Promise<unknown>): Promise<ScrapeCreatorsError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ScrapeCreatorsError);
    return e as ScrapeCreatorsError;
  }
  throw new Error("expected rejection");
}

describe("scGet", () => {
  beforeEach(() => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("sends x-api-key and builds the URL, dropping undefined/null params", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ success: true, ok: 1 }));
    const body = await scGet(
      "/v1/tiktok/search/keyword",
      { query: "cats & dogs", cursor: undefined, region: null, trim: true, page: 2 },
      { fetchImpl },
    );
    expect(body).toEqual({ success: true, ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    const u = new URL(String(url));
    expect(u.origin).toBe("https://api.scrapecreators.com");
    expect(u.pathname).toBe("/v1/tiktok/search/keyword");
    expect([...u.searchParams.keys()].sort()).toEqual(["page", "query", "trim"]);
    expect(u.searchParams.get("query")).toBe("cats & dogs");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
    expect(init?.method).toBe("GET");
    expect(String(url)).not.toContain(KEY);
  });

  it.each<[number, ScrapeCreatorsErrorKind]>([
    [400, "bad_request"],
    [401, "unauthorized"],
    [402, "out_of_credits"],
    [403, "forbidden"],
    [404, "not_found"],
    [500, "upstream"],
    [502, "upstream"],
    [429, "upstream"],
  ])("maps HTTP %i to kind %s, without leaking the key", async (status, kind) => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, message: `bad key ${KEY}` }, status));
    const err = await catchErr(scGet("/v1/youtube/search", { query: "x" }, { fetchImpl }));
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
    expect(err.message).not.toContain(KEY);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });

  it("treats 200 with success:false as upstream", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, error: "oops" }));
    const err = await catchErr(scGet("/v1/youtube/search", {}, { fetchImpl }));
    expect(err.kind).toBe("upstream");
    expect(err.status).toBe(200);
  });

  it("treats invalid JSON as upstream", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect((await catchErr(scGet("/v1/youtube/search", {}, { fetchImpl }))).kind).toBe("upstream");
  });

  it("times out via AbortController after timeoutMs", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const p = catchErr(scGet("/v1/tiktok/get-trending-feed", { region: "US" }, { fetchImpl: fetchImpl as typeof fetch }));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const err = await p;
    expect(err.kind).toBe("timeout");
    expect(err.message).toContain("15000");
  });

  it("defaults to a 15 s timeout and honours a custom one", async () => {
    vi.useFakeTimers();
    const hang = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort"))));
    const p = catchErr(scGet("/v1/x", {}, { fetchImpl: hang as typeof fetch, timeoutMs: 50 }));
    await vi.advanceTimersByTimeAsync(50);
    expect((await p).kind).toBe("timeout");
  });

  it("maps network failures to kind network without exposing the cause message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError(`fetch failed with header ${KEY}`);
    });
    const err = await catchErr(scGet("/v1/x", {}, { fetchImpl }));
    expect(err.kind).toBe("network");
    expect(err.message).not.toContain(KEY);
  });

  it("maps caller aborts to network", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fetchImpl = vi.fn(async (_u: unknown, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return jsonResponse({});
    });
    const err = await catchErr(scGet("/v1/x", {}, { fetchImpl: fetchImpl as typeof fetch, signal: ctrl.signal }));
    expect(err.kind).toBe("network");
    expect(err.message).toContain("aborted");
  });

  it.each(["", "   "])("throws missing_key when the key is %j and never calls fetch", async (value) => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", value);
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const err = await catchErr(scGet("/v1/x", {}, { fetchImpl }));
    expect(err.kind).toBe("missing_key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses absolute or protocol-relative paths so the key cannot go to another host", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    expect((await catchErr(scGet("https://evil.example/x", {}, { fetchImpl }))).kind).toBe("bad_request");
    expect((await catchErr(scGet("//evil.example/x", {}, { fetchImpl }))).kind).toBe("bad_request");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("buildScUrl encodes params", () => {
    expect(buildScUrl("/v1/a", { q: "a b#c" }).toString()).toBe("https://api.scrapecreators.com/v1/a?q=a+b%23c");
  });
});
