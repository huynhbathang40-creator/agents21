import { useCallback, useEffect, useState } from "react";

export type NavigateMode = "push" | "replace";

/**
 * The URL query string as React state (no router). `navigate` writes a new query string with
 * history.pushState (new searches, so Back works) or replaceState (sort/filter tweaks).
 */
export function useLocationSearch(): [string, (query: string, mode: NavigateMode) => void] {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((query: string, mode: NavigateMode) => {
    const { pathname, search: current, hash } = window.location;
    const nextSearch = query ? `?${query}` : "";
    if (nextSearch === current) return;
    if (mode === "push") {
      window.history.pushState(null, "", `${pathname}${nextSearch}`);
    } else {
      window.history.replaceState(window.history.state, "", `${pathname}${nextSearch}${hash}`);
    }
    setSearch(window.location.search);
  }, []);

  return [search, navigate];
}
