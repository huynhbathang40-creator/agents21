import { useCallback, useEffect, useState } from "react";
import {
  DARK_QUERY,
  applyTheme,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

/** Theme preference + resolved theme; "system" tracks prefers-color-scheme changes live. */
export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
} {
  const [preference, setPref] = useState<ThemePreference>(() => readThemePreference());
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark());

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    writeThemePreference(p);
    setPref(p);
  }, []);

  return { preference, resolved, setPreference };
}
