import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getStore = vi.fn();
vi.mock("@netlify/blobs", () => ({ getStore: (...args: unknown[]) => getStore(...args) }));

const { checkRateLimit, clientIp, rateLimitPerMinute } = await import("./rateLimit");

function memoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: vi.fn(async (k: string) => (data.has(k) ? structuredClone(data.get(k)) : null)),
    setJSON: vi.fn(async (k: string, v: unknown) => void data.set(k, structuredClone(v))),
  };
}

const req = (headers: Record<string, string> = {}) => new Request("https://example.test/api/search", { headers });
const T0 = 1_700_000_040_000;
const bucketStart = Math.floor(T0 / 60_000) * 60_000;

beforeEach(() => {
  getStore.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("prefers x-nf-client-connection-ip, then first x-forwarded-for, then unknown", () => {
    expect(clientIp(req({ "x-nf-client-connection-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(req({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("rateLimitPerMinute", () => {
  it("defaults to 30 and honours RATE_LIMIT_PER_MIN", () => {
    expect(rateLimitPerMinute()).toBe(30);
    vi.stubEnv("RATE_LIMIT_PER_MIN", "5");
    expect(rateLimitPerMinute()).toBe(5);
    vi.stubEnv("RATE_LIMIT_PER_MIN", "0");
    expect(rateLimitPerMinute()).toBe(30);
    vi.stubEnv("RATE_LIMIT_PER_MIN", "lots");
    expect(rateLimitPerMinute()).toBe(30);
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit in a window, then 429s with Retry-After to the window end", async () => {
    const s = memoryStore();
    getStore.mockReturnValue(s);
    const r = req({ "x-nf-client-connection-ip": "9.9.9.9" });
    const now = bucketStart + 20_500;
    for (let i = 0; i < 3; i++) expect(await checkRateLimit(r, { limit: 3, now })).toEqual({ allowed: true });
    expect(await checkRateLimit(r, { limit: 3, now })).toEqual({ allowed: false, retryAfterSec: 40 });
    expect(getStore).toHaveBeenCalledWith({ name: "rate-limit", consistency: "strong" });
    // the raw IP is never stored
    expect([...s.data.keys()].join()).not.toContain("9.9.9.9");
  });

  it("resets in the next window", async () => {
    getStore.mockReturnValue(memoryStore());
    const r = req({ "x-nf-client-connection-ip": "9.9.9.9" });
    await checkRateLimit(r, { limit: 1, now: bucketStart + 59_999 });
    expect((await checkRateLimit(r, { limit: 1, now: bucketStart + 59_999 })).allowed).toBe(false);
    expect((await checkRateLimit(r, { limit: 1, now: bucketStart + 60_000 })).allowed).toBe(true);
  });

  it("counts IPs separately", async () => {
    getStore.mockReturnValue(memoryStore());
    const now = bucketStart;
    expect((await checkRateLimit(req({ "x-forwarded-for": "1.1.1.1" }), { limit: 1, now })).allowed).toBe(true);
    expect((await checkRateLimit(req({ "x-forwarded-for": "2.2.2.2" }), { limit: 1, now })).allowed).toBe(true);
    expect((await checkRateLimit(req({ "x-forwarded-for": "1.1.1.1" }), { limit: 1, now })).allowed).toBe(false);
  });

  it("uses the env limit when none is injected", async () => {
    vi.stubEnv("RATE_LIMIT_PER_MIN", "2");
    getStore.mockReturnValue(memoryStore());
    const now = bucketStart;
    await checkRateLimit(req(), { now });
    await checkRateLimit(req(), { now });
    expect((await checkRateLimit(req(), { now })).allowed).toBe(false);
  });

  it("fails open when Blobs is unavailable", async () => {
    getStore.mockImplementation(() => {
      throw new Error("MissingBlobsEnvironmentError");
    });
    for (let i = 0; i < 5; i++) expect(await checkRateLimit(req(), { limit: 1 })).toEqual({ allowed: true });
  });

  it("fails open when Blobs calls reject", async () => {
    getStore.mockReturnValue({ get: vi.fn().mockRejectedValue(new Error("down")), setJSON: vi.fn() });
    expect(await checkRateLimit(req(), { limit: 1 })).toEqual({ allowed: true });
  });
});
