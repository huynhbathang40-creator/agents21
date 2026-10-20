import { useTheme } from "../hooks/useTheme";
import { THEME_LABELS, nextThemePreference, type ThemePreference } from "../lib/theme";
import { FOCUS_RING } from "./focus";

const ICON = "h-5 w-5";

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden="true" focusable="false">
        <path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM9.25 1.5h1.5v2.5h-1.5zM9.25 16h1.5v2.5h-1.5zM1.5 9.25h2.5v1.5H1.5zM16 9.25h2.5v1.5H16zM3.4 4.46l1.06-1.06 1.77 1.77-1.06 1.06zM13.77 14.83l1.06-1.06 1.77 1.77-1.06 1.06zM3.4 15.54l1.77-1.77 1.06 1.06-1.77 1.77zM13.77 5.17l1.77-1.77 1.06 1.06-1.77 1.77z" />
      </svg>
    );
  }
  if (preference === "dark") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden="true" focusable="false">
        <path d="M17.3 12.9A7.5 7.5 0 0 1 7.1 2.7a7.5 7.5 0 1 0 10.2 10.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden="true" focusable="false">
      <path d="M2 4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5v1.5h2V17H6v-1.5h2V14H3a1 1 0 0 1-1-1V4Zm1.5.5v8h13v-8h-13Z" />
    </svg>
  );
}

/** Three-state theme toggle (system → light → dark). Visible text on wider screens; always labelled. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const next = nextThemePreference(preference);
  const current = THEME_LABELS[preference];
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${current}. Switch to ${THEME_LABELS[next]}`}
      title={`Theme: ${current} (switch to ${THEME_LABELS[next]})`}
      className={`inline-flex items-center gap-1.5 rounded-md border border-neutral-400 px-2.5 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 dark:border-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800 ${FOCUS_RING}`}
    >
      <ThemeIcon preference={preference} />
      <span className="hidden sm:inline" aria-hidden="true">
        Theme: {current}
      </span>
    </button>
  );
}
