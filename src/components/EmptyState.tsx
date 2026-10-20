const SUGGESTED_HASHTAGS = ["#fitness", "#recipes", "#travel", "#comedy", "#tech", "#fashion"];

interface Props {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = "No trending videos right now",
  message = "Try another platform or region. Popular topics people are exploring:",
}: Props) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{message}</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Suggested hashtags">
        {SUGGESTED_HASHTAGS.map((tag) => (
          <li
            key={tag}
            className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}
