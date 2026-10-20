import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "../shared/types";

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Backend responded with HTTP ${res.status}`);
  return res.json();
}

function StatusRow({ label, ok, okText, badText }: { label: string; ok: boolean | null; okText: string; badText: string }) {
  const tone =
    ok === null
      ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      : ok
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="font-medium">{label}</dt>
      <dd className={`rounded-full px-3 py-1 text-sm ${tone}`}>{ok === null ? "Checking…" : ok ? okText : badText}</dd>
    </div>
  );
}

export default function App() {
  const { data, error, isPending, refetch, isFetching } = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const backendUp = isPending ? null : !error;
  const keySet = isPending ? null : Boolean(data?.apiKeyConfigured);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">TrendScope</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Trending videos from TikTok, Instagram and YouTube are coming soon. This page checks that the backend is set up.
      </p>

      <dl className="mt-8 divide-y divide-neutral-200 rounded-xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
        <StatusRow label="Backend" ok={backendUp} okText="Running" badText="Not reachable" />
        <StatusRow label="Scrape Creators API key" ok={backendUp === false ? false : keySet} okText="Set" badText="Not set" />
      </dl>

      {error && (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-300" role="alert">
          {error.message}. If you are running locally, start the app with <code>netlify dev</code> so <code>/api</code> works.
        </p>
      )}
      {data && !data.apiKeyConfigured && (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-300">
          Add your Scrape Creators API key under Netlify → Site configuration → Environment variables (see the
          README), then redeploy.
        </p>
      )}

      <button
        type="button"
        onClick={() => refetch()}
        disabled={isFetching}
        className="mt-6 self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {isFetching ? "Checking…" : "Check again"}
      </button>
    </main>
  );
}
