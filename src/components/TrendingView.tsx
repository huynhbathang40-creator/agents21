import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTrending, PasswordRequiredError } from "../lib/api";
import { PLATFORM_LABELS, regionApplies } from "../lib/platforms";
import { documentTitle } from "../lib/search";
import { sortVideos } from "../lib/sort";
import type { ViewState } from "../lib/viewState";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LiveRegion } from "./LiveRegion";
import { PasswordForm } from "./PasswordForm";
import { PlatformNotice } from "./PlatformNotice";
import { PlatformTabs, tabId } from "./PlatformTabs";
import { RegionSelect } from "./RegionSelect";
import { SortSelect } from "./SortSelect";
import { VideoGrid, VideoGridSkeleton } from "./VideoGrid";
import { FOCUS_RING } from "./focus";

const MAX_CARDS = 30; // FR-2
const PANEL_ID = "trending-panel";

interface Props {
  state: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  /** Runs a search for a suggested hashtag from the empty state. */
  onSearch: (q: string) => void;
}

export function TrendingView({ state, onChange: update, onSearch }: Props) {
  const { platform, region, sort } = state;
  // Region only affects TikTok; other platforms share one cache entry regardless of the selector.
  const effectiveRegion = regionApplies(platform) ? region : undefined;

  const query = useQuery({
    queryKey: ["trending", platform, effectiveRegion ?? null],
    queryFn: ({ signal }) => fetchTrending(platform, effectiveRegion, signal),
  });

  const videos = useMemo(
    () => sortVideos((query.data?.results ?? []).slice(0, MAX_CARDS), sort),
    [query.data, sort],
  );
  const platformErrors = query.data?.errors ?? [];
  const refreshing = query.isFetching && !query.isPending;
  const retry = () => void query.refetch();
  const label = PLATFORM_LABELS[platform];

  useEffect(() => {
    document.title = documentTitle(`Trending on ${label}`);
  }, [label]);

  let announcement = "";
  if (query.isPending) announcement = `Loading trending videos on ${label}…`;
  else if (query.isSuccess) announcement = `${videos.length} trending ${videos.length === 1 ? "video" : "videos"} on ${label}`;

  let content;
  if (query.isPending) {
    content = <VideoGridSkeleton />;
  } else if (query.error instanceof PasswordRequiredError) {
    content = <PasswordForm incorrect={query.error.incorrect} onSubmitted={retry} submitting={query.isFetching} />;
  } else if (query.isError) {
    content = <ErrorState message={query.error.message} onRetry={retry} retrying={query.isFetching} />;
  } else if (videos.length === 0 && platformErrors.length > 0) {
    content = <ErrorState message={platformErrors[0].message} onRetry={retry} retrying={query.isFetching} />;
  } else if (videos.length === 0) {
    content = <EmptyState onSelectHashtag={onSearch} />;
  } else {
    content = (
      <div className="space-y-4">
        <PlatformNotice errors={platformErrors} />
        <VideoGrid videos={videos} />
      </div>
    );
  }

  return (
    <section aria-labelledby="trending-heading" className="space-y-4">
      <h1 id="trending-heading" className="text-2xl font-bold text-neutral-900 dark:text-white">
        Trending on {label}
      </h1>
      <LiveRegion message={announcement} />
      <PlatformTabs value={platform} onChange={(p) => update({ platform: p })} panelId={PANEL_ID} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <RegionSelect
          value={region}
          onChange={(r) => update({ region: r })}
          hint={regionApplies(platform) ? undefined : "Region applies to TikTok"}
        />
        <SortSelect value={sort} onChange={(s) => update({ sort: s })} />
        <button
          type="button"
          onClick={retry}
          disabled={query.isFetching}
          className={`rounded-md border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800 ${FOCUS_RING}`}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(platform)} aria-busy={query.isFetching}>
        {content}
      </div>
    </section>
  );
}
