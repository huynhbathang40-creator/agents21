import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./url";

describe("safeHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(safeHttpUrl("https://www.tiktok.com/@a/video/1")).toBe("https://www.tiktok.com/@a/video/1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects other schemes, relative and empty values", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:image/png;base64,AAAA")).toBeUndefined();
    expect(safeHttpUrl("/relative")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
  });
});
