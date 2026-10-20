import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPassword, getPassword, setPassword } from "./password";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

afterEach(() => {
  clearPassword();
  vi.unstubAllGlobals();
});

describe("password store", () => {
  it("uses sessionStorage when available", () => {
    const storage = fakeStorage();
    vi.stubGlobal("sessionStorage", storage);
    setPassword("pw");
    expect(storage.length).toBe(1);
    expect(getPassword()).toBe("pw");
    clearPassword();
    expect(storage.length).toBe(0);
    expect(getPassword()).toBeUndefined();
  });

  it("falls back to memory when sessionStorage throws", () => {
    const throwing = fakeStorage();
    throwing.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    throwing.getItem = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("sessionStorage", throwing);
    setPassword("mem");
    expect(getPassword()).toBe("mem");
  });

  it("falls back to memory when sessionStorage is missing", () => {
    setPassword("mem2");
    expect(getPassword()).toBe("mem2");
  });
});
