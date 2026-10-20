import type { Video } from "../../shared/types";
import { SkeletonCard } from "./SkeletonCard";
import { VideoCard } from "./VideoCard";

const GRID =
  "mx-auto grid max-w-md grid-cols-1 gap-4 sm:max-w-none sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function VideoGrid({ videos }: { videos: Video[] }) {
  const now = Date.now();
  return (
    <ul className={GRID}>
      {videos.map((video) => (
        <li key={`${video.platform}:${video.id}`} className="min-w-0">
          <VideoCard video={video} now={now} />
        </li>
      ))}
    </ul>
  );
}

export function VideoGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading videos…</span>
      <div className={GRID}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
