import * as crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredPassword, isAuthorized, passwordMatches } from "./auth";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const req = (pw?: string) =>
  new Request("https://example.test/api/trending", pw === undefined ? {} : { headers: { "x-app-password": pw } });

afterEach(() => vi.unstubAllEnvs());

describe("passwordMatches", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("s3cret", "s3cret")).toBe(true);
    expect(passwordMatches("s3cret ", "s3cret")).toBe(true); // surrounding whitespace is trimmed
    expect(passwordMatches("S3cret", "s3cret")).toBe(false);
    expect(passwordMatches("s3cre", "s3cret")).toBe(false);
    expect(passwordMatches("s3cret-and-more", "s3cret")).toBe(false);
    expect(passwordMatches("", "s3cret")).toBe(false);
    expect(passwordMatches(null, "s3cret")).toBe(false);
    expect(passwordMatches(undefined, "s3cret")).toBe(false);
  });

  it("uses timingSafeEqual on equal-length SHA-256 digests (no length leak)", () => {
    const spy = vi.mocked(crypto.timingSafeEqual);
    spy.mockClear();
    passwordMatches("x", "a-much-longer-password");
    expect(spy).toHaveBeenCalledTimes(1);
    const [a, b] = spy.mock.calls[0] as [Buffer, Buffer];
    expect(a.length).toBe(32);
    expect(b.length).toBe(32);
  });
});

describe("isAuthorized", () => {
  it("is open when APP_PASSWORD is unset or blank", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(configuredPassword()).toBeUndefined();
    expect(isAuthorized(req())).toBe(true);
    vi.stubEnv("APP_PASSWORD", "   ");
    expect(isAuthorized(req())).toBe(true);
  });

  it("requires the header when APP_PASSWORD is set", () => {
    vi.stubEnv("APP_PASSWORD", "open-sesame");
    expect(isAuthorized(req())).toBe(false);
    expect(isAuthorized(req("wrong"))).toBe(false);
    expect(isAuthorized(req("open-sesame"))).toBe(true);
  });
});
