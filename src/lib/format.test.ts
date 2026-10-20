import { describe, expect, it } from "vitest";
import { compactNumber, formatDuration, relativeDate, truncate } from "./format";

describe("compactNumber", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.2K"],
    [34_000, "34K"],
    [99_950, "100K"],
    [123_456, "123K"],
    [999_999, "1M"],
    [1_250_000, "1.3M"],
    [12_345_678, "12.3M"],
    [2_000_000_000, "2B"],
    [-1500, "-1.5K"],
  ])("%d -> %s", (input, expected) => {
    expect(compactNumber(input)).toBe(expected);
  });

  it("returns a dash for missing or non-finite values", () => {
    expect(compactNumber(undefined)).toBe("–");
    expect(compactNumber(null)).toBe("–");
    expect(compactNumber(Number.NaN)).toBe("–");
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe("–");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [59.9, "0:59"],
    [65, "1:05"],
    [600, "10:00"],
    [3661, "1:01:01"],
  ])("%d -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it("returns empty string for missing/invalid input", () => {
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(-1)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

describe("relativeDate", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();

  it.each([
    [10, "just now"],
    [5 * 60, "5m ago"],
    [3 * 3600, "3h ago"],
    [3 * 86400, "3d ago"],
    [14 * 86400, "2w ago"],
    [120 * 86400, "4mo ago"],
    [800 * 86400, "2y ago"],
  ])("%d seconds ago -> %s", (sec, expected) => {
    expect(relativeDate(ago(sec), now)).toBe(expected);
  });

  it("treats future dates as just now", () => {
    expect(relativeDate(ago(-3600), now)).toBe("just now");
  });

  it("returns empty string for missing/invalid input", () => {
    expect(relativeDate(undefined, now)).toBe("");
    expect(relativeDate("", now)).toBe("");
    expect(relativeDate("not a date", now)).toBe("");
  });
});

describe("truncate", () => {
  it("collapses whitespace and leaves short text alone", () => {
    expect(truncate("  hello \n  world ", 50)).toBe("hello world");
  });

  it("truncates with an ellipsis within the limit", () => {
    const out = truncate("abcdefghij", 5);
    expect(out).toBe("abcd…");
    expect(out.length).toBe(5);
  });
});
