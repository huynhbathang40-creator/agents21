import { useCallback, useEffect, useState } from "react";
import { parseViewState, serializeViewState, type ViewState } from "../lib/viewState";

/** View state mirrored to the URL query string via history.replaceState (no router). */
export function useViewState(): [ViewState, (patch: Partial<ViewState>) => void] {
  const [state, setState] = useState<ViewState>(() => parseViewState(window.location.search));

  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const next = serializeViewState(state, search);
    if (`?${next}` !== search) {
      window.history.replaceState(window.history.state, "", `${pathname}?${next}${hash}`);
    }
  }, [state]);

  useEffect(() => {
    const onPopState = () => setState(parseViewState(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const update = useCallback((patch: Partial<ViewState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  return [state, update];
}
