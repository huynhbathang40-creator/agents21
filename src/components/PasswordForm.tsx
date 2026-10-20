import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { setPassword } from "../lib/password";
import { FOCUS_RING } from "./focus";

interface Props {
  /** True when the last password sent was rejected. */
  incorrect: boolean;
  /** Called after the password is stored; should re-run the failed request(s). */
  onSubmitted: () => void;
  submitting?: boolean;
}

/** Shown in place of results when /api returns 401. The password is kept in sessionStorage only. */
export function PasswordForm({ incorrect, onSubmitted, submitting = false }: Props) {
  const inputId = useId();
  const errorId = useId();
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [emptyError, setEmptyError] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [incorrect]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setEmptyError(true);
      inputRef.current?.focus();
      return;
    }
    setEmptyError(false);
    setPassword(trimmed);
    setValue("");
    onSubmitted();
  };

  const error = emptyError ? "Enter the password." : incorrect ? "Incorrect password. Please try again." : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto max-w-sm rounded-xl border border-neutral-200 bg-white px-6 py-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 id={headingId} className="text-lg font-semibold text-neutral-900 dark:text-white">
        This app is password protected
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        Enter the password you were given to use TrendScope. It is kept only for this browser tab.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Password
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`mt-1 w-full rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-500 dark:bg-neutral-950 dark:text-neutral-100 ${FOCUS_RING}`}
          />
          {error && (
            <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className={`w-full rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-60 ${FOCUS_RING}`}
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </section>
  );
}
