export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse overflow-hidden rounded-xl border border-neutral-200 bg-white motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="aspect-[9/16] w-full bg-neutral-200 dark:bg-neutral-800" />
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
