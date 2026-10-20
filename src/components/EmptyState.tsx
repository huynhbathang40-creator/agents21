import { SUGGESTED_HASHTAGS } from "../lib/search";
import { FOCUS_RING } from "./focus";

interface Props {
  title?: string;
  message?: string;
  /** When provided, suggested hashtags become buttons that run that search. */
  onSelectHashtag?: (tag: string) => void;
}

export function EmptyState({
  title = "No trending videos right now",
  message = "Try another platform or region, or search one of these popular hashtags:",
  onSelectHashtag,
}: Props) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center dark:border-neutral-600">
      <h2 className="break-words text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{message}</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Suggested hashtags">
        {SUGGESTED_HASHTAGS.map((tag) => (
          <li key={tag}>
            {onSelectHashtag ? (
              <button
                type="button"
                onClick={() => onSelectHashtag(tag)}
                aria-label={`Search ${tag}`}
                className={`rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-indigo-100 hover:text-indigo-900 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-indigo-950 dark:hover:text-indigo-100 ${FOCUS_RING}`}
              >
                {tag}
              </button>
            ) : (
              <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                {tag}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
