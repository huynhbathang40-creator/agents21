import { useId, type ReactNode } from "react";
import { FOCUS_RING } from "./focus";

interface Props<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  /** Optional helper text, linked to the select via aria-describedby. */
  hint?: string;
}

/** Native select with a visible label. */
export function Select<T extends string>({ label, value, onChange, children, hint }: Props<T>) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-describedby={hint ? hintId : undefined}
        className={`max-w-full rounded-md border border-neutral-400 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100 ${FOCUS_RING}`}
      >
        {children}
      </select>
      {hint && (
        <span id={hintId} className="text-xs text-neutral-600 dark:text-neutral-400">
          {hint}
        </span>
      )}
    </div>
  );
}
