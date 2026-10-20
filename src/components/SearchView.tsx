import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PasswordRequiredError, searchVideos } from "../lib/api";
import { documentTitle, firstPageParam, mergePages, nextPageParam, searchSummary } from "../lib/search";
import { sortVideos, type SortKey } from "../lib/sort";
import type { SearchState } from "../lib/viewState";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LiveRegion } from "./LiveRegion";
import { PasswordForm } from "./PasswordForm";
import { PlatformNotice } from "./PlatformNotice";
import { SortSelect } from "./SortSelect";
import { VideoGrid, VideoGridSkeleton } from "./VideoGrid";
import { FOCUS_RING } from "./focus";

interface Props {
  state: SearchState;
  onSortChange: (sort: SortKey) => void;
  onSearch: (q: string) => void;
}

const BUTTON = `rounded-md border border-neutral-400 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800 ${FOCUS_RING}`;

export function SearchView({ state, onSortChange, onSearch }: Props) {
  const { q, platforms, sort } = state;

  const query = useInfiniteQuery({
    queryKey: ["search", q, platforms.join(",")],
    queryFn: ({ pageParam, signal }) => searchVideos(q, pageParam.platforms, pageParam.cursors, signal),
    initialPageParam: firstPageParam(platforms),
    getNextPageParam: (lastPage, _pages, lastParam) => nextPageParam(lastPage, lastParam.platforms),
  });

  const merged = useMemo(() => mergePages(query.data?.pages ?? []), [query.data]);
  const videos = useMemo(() => sortVideos(merged.results, sort), [merged, sort]);
  const summary = searchSummary(q, platforms, query.data ? videos.length : undefined);

  useEffect(() => {
    document.title = documentTitle(q);
  }, [q]);

  const retry = () => void query.refetch();
  const loadMore = () => void query.fetchNextPage();

  let announcement = "";
  if (query.isPending) announcement = `Searching for ${q}…`;
  else if (query.isFetchingNextPage) announcement = "Loading more results…";
  else if (query.data) announcement = summary;

  let content;
  if (query.isPending) {
    content = <VideoGridSkeleton />;
  } else if (!query.data) {
    // First page failed.
    content =
      query.error instanceof PasswordRequiredError ? (
        <PasswordForm incorrect={query.error.incorrect} onSubmitted={retry} submitting={query.isFetching} />
      ) : (
        <ErrorState
          title="Couldn't load results"
          message={query.error?.message ?? "Something went wrong."}
          onRetry={retry}
          retrying={query.isFetching}
        />
      );
  } else if (videos.length === 0 && merged.errors.length > 0) {
    content = (
      <ErrorState title="Couldn't load results" message={merged.errors[0].message} onRetry={retry} retrying={query.isFetching} />
    );
  } else if (videos.length === 0) {
    content = (
      <EmptyState
        title={`No results for “${q}”`}
        message="Try a different keyword, more platforms, or one of these hashtags:"
        onSelectHashtag={onSearch}
      />
    );
  } else {
    let more = null;
    if (query.isFetchNextPageError && query.error instanceof PasswordRequiredError) {
      more = <PasswordForm incorrect={query.error.incorrect} onSubmitted={loadMore} submitting={query.isFetchingNextPage} />;
    } else if (query.isFetchNextPageError) {
      more = (
        <div role="alert" className="flex flex-col items-center gap-2 text-center">
          <p className="break-words text-sm text-red-800 dark:text-red-200">
            Couldn&apos;t load more results. {query.error?.message}
          </p>
          <button type="button" onClick={loadMore} disabled={query.isFetchingNextPage} className={BUTTON}>
            {query.isFetchingNextPage ? "Loading…" : "Try again"}
          </button>
        </div>
      );
    } else if (query.hasNextPage) {
      more = (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={query.isFetchingNextPage} className={BUTTON}>
            {query.isFetchingNextPage ? "Loading more…" : "Load more"}
          </button>
        </div>
      );
    }
    content = (
      <div className="space-y-4">
        <VideoGrid videos={videos} />
        {more}
      </div>
    );
  }

  return (
    <section aria-labelledby="search-heading" className="space-y-4">
      <h1 id="search-heading" className="break-words text-2xl font-bold text-neutral-900 dark:text-white">
        Results for “{q}”
      </h1>
      <LiveRegion message={announcement} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="inline-block max-w-full break-words rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
          {query.isPending ? searchSummary(q, platforms) : summary}
        </p>
        <SortSelect value={sort} onChange={onSortChange} />
      </div>
      {query.data && <PlatformNotice errors={videos.length > 0 ? merged.errors : []} />}
      <div aria-busy={query.isFetching}>{content}</div>
    </section>
  );
}
