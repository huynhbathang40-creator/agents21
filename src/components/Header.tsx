import type { ReactNode } from "react";
import { FOCUS_RING } from "./focus";

interface Props {
  /** M5: the search bar (keyword / #hashtag + platform filters) renders here. */
  searchSlot?: ReactNode;
}

export function Header({ searchSlot }: Props) {
  return (
    <header className="border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <a
          href="/"
          className={`rounded-md text-xl font-bold tracking-tight text-neutral-900 dark:text-white ${FOCUS_RING}`}
        >
          Trend<span className="text-indigo-700 dark:text-indigo-300">Scope</span>
        </a>
        {/* Search slot (M5). */}
        <div className="min-w-0 flex-1" data-slot="search">
          {searchSlot}
        </div>
      </div>
    </header>
  );
}
