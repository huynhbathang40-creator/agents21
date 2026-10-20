import { useRef, type KeyboardEvent } from "react";
import { PLATFORMS, type Platform } from "../../shared/types";
import { PLATFORM_LABELS } from "../lib/platforms";
import { FOCUS_RING } from "./focus";

interface Props {
  value: Platform;
  onChange: (platform: Platform) => void;
  panelId: string;
}

export function tabId(platform: Platform): string {
  return `platform-tab-${platform}`;
}

/** WAI-ARIA tabs pattern with automatic activation and roving tabindex. */
export function PlatformTabs({ value, onChange, panelId }: Props) {
  const refs = useRef<Partial<Record<Platform, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = PLATFORMS.indexOf(value);
    let next: number | undefined;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % PLATFORMS.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + PLATFORMS.length) % PLATFORMS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = PLATFORMS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const platform = PLATFORMS[next];
    onChange(platform);
    refs.current[platform]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Platform"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
    >
      {PLATFORMS.map((platform) => {
        const selected = platform === value;
        return (
          <button
            key={platform}
            ref={(el) => {
              refs.current[platform] = el;
            }}
            id={tabId(platform)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(platform)}
            onKeyDown={onKeyDown}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${FOCUS_RING} ${
              selected
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white"
                : "text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            {PLATFORM_LABELS[platform]}
          </button>
        );
      })}
    </div>
  );
}
