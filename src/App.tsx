import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLATFORMS, type Platform } from "../shared/types";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { SearchView } from "./components/SearchView";
import { SetupBanner } from "./components/SetupBanner";
import { TrendingView } from "./components/TrendingView";
import { useLocationSearch } from "./hooks/useLocationSearch";
import { normalizeQuery } from "./lib/search";
import type { SortKey } from "./lib/sort";
import {
  parseSearchState,
  parseViewState,
  serializeSearchState,
  serializeTrendingState,
  serializeViewState,
  type ViewState,
} from "./lib/viewState";

/** View routing via URL state: ?q= → search view, otherwise trending (no router dependency). */
export default function App() {
  const [search, navigate] = useLocationSearch();
  const searchState = useMemo(() => parseSearchState(search), [search]);
  const trendingState = useMemo(() => parseViewState(search), [search]);
  // Platform selection used for the next search while on the trending view.
  const [draftPlatforms, setDraftPlatforms] = useState<Platform[]>(() => [...PLATFORMS]);
  const platforms = searchState?.platforms ?? draftPlatforms;
  const sort = searchState?.sort ?? trendingState.sort;
  // Last trending tab/region, so "Trending" returns where the user was.
  const lastTrending = useRef<ViewState>(trendingState);

  // Canonicalize the URL (validated values, defaults filled in) without adding history entries.
  useEffect(() => {
    if (searchState) {
      navigate(serializeSearchState(searchState, search), "replace");
    } else {
      lastTrending.current = trendingState;
      navigate(serializeViewState(trendingState, search), "replace");
    }
  }, [search, searchState, trendingState, navigate]);

  const runSearch = useCallback(
    (raw: string, nextPlatforms: Platform[] = platforms) => {
      const q = normalizeQuery(raw);
      if (!q) return;
      navigate(serializeSearchState({ q, platforms: nextPlatforms, sort }, search), "push");
    },
    [navigate, platforms, search, sort],
  );

  const onPlatformsChange = (next: Platform[]) => {
    setDraftPlatforms(next);
    if (searchState) navigate(serializeSearchState({ ...searchState, platforms: next }, search), "replace");
  };

  const onSearchSort = (nextSort: SortKey) => {
    if (searchState) navigate(serializeSearchState({ ...searchState, sort: nextSort }, search), "replace");
  };

  const onTrendingChange = (patch: Partial<ViewState>) => {
    navigate(serializeViewState({ ...trendingState, ...patch }, search), "replace");
  };

  const goTrending = () => {
    navigate(serializeTrendingState({ ...lastTrending.current, sort }, search), "push");
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-neutral-900 focus:ring-2 focus:ring-indigo-600"
      >
        Skip to content
      </a>
      <Header
        searchSlot={
          <SearchBar
            query={searchState?.q ?? ""}
            platforms={platforms}
            onPlatformsChange={onPlatformsChange}
            onSearch={runSearch}
            onTrending={searchState ? goTrending : undefined}
          />
        }
      />
      <SetupBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 focus:outline-none sm:px-6">
        {searchState ? (
          <SearchView state={searchState} onSortChange={onSearchSort} onSearch={runSearch} />
        ) : (
          <TrendingView state={trendingState} onChange={onTrendingChange} onSearch={runSearch} />
        )}
      </main>
      <Footer />
    </div>
  );
}
