// Light/dark theme preference (PRD §11). "system" follows prefers-color-scheme.
// Stored in localStorage; every storage access is guarded (private mode, disabled storage, tests).

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "trendscope.theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

function defaultStorage(): ThemeStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readThemePreference(storage: ThemeStorage | undefined = defaultStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** "system" removes the stored value so the default applies. Errors are swallowed. */
export function writeThemePreference(pref: ThemePreference, storage: ThemeStorage | undefined = defaultStorage()): void {
  try {
    if (pref === "system") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore: preference simply won't persist
  }
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}

/** Toggle cycles system → light → dark → system. */
export function nextThemePreference(pref: ThemePreference): ThemePreference {
  const i = THEME_PREFERENCES.indexOf(pref);
  return THEME_PREFERENCES[(i + 1) % THEME_PREFERENCES.length];
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** Applies the theme as a `dark` class on <html> (Tailwind darkMode: "class"). */
export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
