import type { PlatformError } from "../../shared/types";
import { PLATFORM_LABELS } from "../lib/platforms";

/** Inline, non-blocking notice for per-platform failures (FR-8). */
export function PlatformNotice({ errors }: { errors: PlatformError[] }) {
  if (errors.length === 0) return null;
  return (
    // role="status" on a wrapper, not the <ul>, so the list keeps its list semantics.
    <div role="status">
      <ul className="space-y-1">
        {errors.map((err, i) => (
          <li
            key={`${err.platform}-${i}`}
            className="break-words rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {err.message || `${PLATFORM_LABELS[err.platform] ?? err.platform} unavailable`}
          </li>
        ))}
      </ul>
    </div>
  );
}
