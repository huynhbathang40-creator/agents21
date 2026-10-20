import { FOCUS_RING } from "./focus";

interface Props {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying = false }: Props) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded-xl border border-red-300 bg-red-50 px-6 py-8 text-center dark:border-red-800 dark:bg-red-950/40"
    >
      <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Couldn't load videos</h2>
      <p className="mt-2 break-words text-sm text-red-800 dark:text-red-200">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={`mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 ${FOCUS_RING}`}
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
