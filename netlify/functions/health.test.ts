import { afterEach, describe, expect, it, vi } from "vitest";
import type { HealthResponse } from "../../shared/types";
import handler from "./health";

const FAKE_KEY = "test-key-should-never-leak-123";
const FAKE_PASSWORD = "test-password-should-never-leak";

const get = () => handler(new Request("https://example.test/api/health"));
const getBody = async () => (await (await get()).json()) as HealthResponse;

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("reports ok and an unconfigured key when no env vars are set", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "");
    vi.stubEnv("APP_PASSWORD", "");
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", apiKeyConfigured: false, passwordProtected: false });
  });

  it("reports the key and password as configured when set", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", FAKE_KEY);
    vi.stubEnv("APP_PASSWORD", FAKE_PASSWORD);
    const body = await getBody();
    expect(body.apiKeyConfigured).toBe(true);
    expect(body.passwordProtected).toBe(true);
  });

  it("treats a whitespace-only key as not configured", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "   ");
    const body = await getBody();
    expect(body.apiKeyConfigured).toBe(false);
  });

  it("never leaks the key or password in the body or headers", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", FAKE_KEY);
    vi.stubEnv("APP_PASSWORD", FAKE_PASSWORD);
    const res = await get();
    const text = await res.text();
    const headers = JSON.stringify([...res.headers.entries()]);
    for (const secret of [FAKE_KEY, FAKE_PASSWORD]) {
      expect(text).not.toContain(secret);
      expect(headers).not.toContain(secret);
    }
  });

  it("is not cached and sets nosniff", async () => {
    const res = await get();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects non-GET methods", async () => {
    const res = await handler(new Request("https://example.test/api/health", { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
