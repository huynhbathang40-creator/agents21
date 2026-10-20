import { useEffect, useId, useState, type FormEvent } from "react";
import type { Platform } from "../../shared/types";
import { MAX_QUERY_LENGTH, isHashtagQuery, normalizeQuery } from "../lib/search";
import { PlatformFilter } from "./PlatformFilter";
import { FOCUS_RING } from "./focus";

interface Props {
  /** Current search query from the URL ("" on the trending view). */
  query: string;
  platforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  onSearch: (q: string) => void;
  /** Shown when on the search view; returns to trending. */
  onTrending?: () => void;
}

export function SearchBar({ query, platforms, onPlatformsChange, onSearch, onTrending }: Props) {
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState(query);

  // Keep the input in sync when the URL changes (Back/Forward, suggestion clicks, "Trending").
  useEffect(() => {
    setValue(query);
  }, [query]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = normalizeQuery(value);
    if (!q) return;
    setValue(q);
    onSearch(q);
  };

  const hashtag = isHashtagQuery(value);

  return (
    <form role="search" aria-label="Search videos" onSubmit={onSubmit} className="flex w-full flex-col gap-2">
      <div className="flex w-full min-w-0 gap-2">
        <label htmlFor={inputId} className="sr-only">
          Search a keyword or #hashtag
        </label>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search a keyword or #hashtag"
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby={hashtag ? hintId : undefined}
          className={`min-w-0 flex-1 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-600 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-400 ${FOCUS_RING}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 ${FOCUS_RING}`}
        >
          Search
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PlatformFilter value={platforms} onChange={onPlatformsChange} />
        {hashtag && (
          <span
            id={hintId}
            className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
          >
            Hashtag search
          </span>
        )}
        {onTrending && (
          <button
            type="button"
            onClick={onTrending}
            className={`ml-auto rounded-md px-2 py-1 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-100 ${FOCUS_RING}`}
          >
            <span aria-hidden="true">← </span>
            Trending
          </button>
        )}
      </div>
    </form>
  );
}
