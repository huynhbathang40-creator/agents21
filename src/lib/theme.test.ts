import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("theme preference storage", () => {
  it("defaults to system when nothing or junk is stored", () => {
    expect(readThemePreference(memoryStorage())).toBe("system");
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "purple" }))).toBe("system");
    expect(readThemePreference(undefined)).toBe("system");
  });

  it("round-trips light and dark; system clears the key", () => {
    const s = memoryStorage();
    writeThemePreference("dark", s);
    expect(s.data.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemePreference(s)).toBe("dark");
    writeThemePreference("light", s);
    expect(readThemePreference(s)).toBe("light");
    writeThemePreference("system", s);
    expect(s.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(readThemePreference(s)).toBe("system");
  });

  it("never throws when storage is unavailable", () => {
    expect(readThemePreference(throwingStorage)).toBe("system");
    expect(() => writeThemePreference("dark", throwingStorage)).not.toThrow();
    expect(() => writeThemePreference("system", throwingStorage)).not.toThrow();
  });
});

describe("theme resolution", () => {
  it("system follows prefers-color-scheme; explicit choices win", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("cycles system → light → dark → system", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("validates preferences", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });

  it("applies the dark class and color-scheme to the root element", () => {
    const classes = new Set<string>();
    const root = {
      classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
      style: { colorScheme: "" },
    } as unknown as HTMLElement;
    applyTheme("dark", root);
    expect(classes.has("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
    applyTheme("light", root);
    expect(classes.has("dark")).toBe(false);
  });
});
