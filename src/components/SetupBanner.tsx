import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../lib/api";
import { FOCUS_RING } from "./focus";

const SETUP_URL = "https://github.com/huynhbathang40-creator/agents21#one-time-netlify-setup";

/** Non-blocking notice when the backend reports it has no data-provider key configured. */
export function SetupBanner() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
    staleTime: Infinity,
    retry: false,
  });

  if (!data || data.apiKeyConfigured) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <p className="mx-auto max-w-screen-2xl px-4 py-2 text-sm sm:px-6">
        Setup needed: the data provider API key isn&apos;t configured yet, so videos can&apos;t load.{" "}
        <a
          href={SETUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded font-medium underline underline-offset-2 ${FOCUS_RING}`}
        >
          See the setup steps in the README
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    </div>
  );
}
