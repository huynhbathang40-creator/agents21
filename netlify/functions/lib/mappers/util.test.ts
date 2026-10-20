import { describe, expect, it } from "vitest";
import { extractHashtags, firstString, mapItems, normalizeHashtag, parseCountText, str, toIsoDate, toNumber } from "./util";

describe("util", () => {
  it("toNumber coerces numbers and numeric strings only", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("abc")).toBeUndefined();
    expect(toNumber(-1)).toBeUndefined();
    expect(toNumber(NaN)).toBeUndefined();
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber({})).toBeUndefined();
  });

  it("parseCountText handles display counts", () => {
    expect(parseCountText("13,798,774 views")).toBe(13798774);
    expect(parseCountText("750K")).toBe(750000);
    expect(parseCountText("1.5M views")).toBe(1500000);
    expect(parseCountText("No views")).toBeUndefined();
  });

  it("toIsoDate accepts unix seconds, ms, numeric strings and ISO strings", () => {
    expect(toIsoDate(1707724682)).toBe("2024-02-12T07:58:02.000Z");
    expect(toIsoDate(1707724682000)).toBe("2024-02-12T07:58:02.000Z");
    expect(toIsoDate("1707724682")).toBe("2024-02-12T07:58:02.000Z");
    expect(toIsoDate("2025-08-07T13:00:22-07:00")).toBe("2025-08-07T20:00:22.000Z");
    expect(toIsoDate("not a date")).toBeUndefined();
    expect(toIsoDate(0)).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
  });

  it("str / firstString", () => {
    expect(str("  a ")).toBe("a");
    expect(str("   ")).toBeUndefined();
    expect(str(7)).toBe("7");
    expect(firstString(undefined, "", " ", null, "x", "y")).toBe("x");
  });

  it("extractHashtags dedupes across texts and supports unicode", () => {
    expect(extractHashtags("#a #b", "#a #ñandú")).toEqual(["a", "b", "ñandú"]);
    expect(extractHashtags("none", undefined)).toBeUndefined();
  });

  it("normalizeHashtag strips leading '#' and whitespace", () => {
    expect(normalizeHashtag("  ##fyp ")).toBe("fyp");
    expect(normalizeHashtag("fyp")).toBe("fyp");
  });

  it("mapItems skips throwing items and duplicate ids", () => {
    const out = mapItems([1, 2, 2, 3], (n) => {
      if (n === 3) throw new Error("boom");
      return { id: String(n) };
    });
    expect(out).toEqual([{ id: "1" }, { id: "2" }]);
  });
});
