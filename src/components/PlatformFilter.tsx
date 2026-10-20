import { useId } from "react";
import { PLATFORMS, type Platform } from "../../shared/types";
import { PLATFORM_LABELS } from "../lib/platforms";
import { orderPlatforms } from "../lib/search";

interface Props {
  value: Platform[];
  onChange: (platforms: Platform[]) => void;
}

/** Platform checkboxes (FR-6). At least one stays checked: the last checked box is disabled. */
export function PlatformFilter({ value, onChange }: Props) {
  const hintId = useId();
  const onlyOne = value.length <= 1;
  const toggle = (platform: Platform, checked: boolean) => {
    const next = checked ? [...value, platform] : value.filter((p) => p !== platform);
    if (next.length === 0) return;
    onChange(orderPlatforms(next));
  };

  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-describedby={onlyOne ? hintId : undefined}>
      <legend className="sr-only">Platforms to search</legend>
      {PLATFORMS.map((platform) => {
        const checked = value.includes(platform);
        const locked = checked && onlyOne;
        return (
          <label
            key={platform}
            className={`inline-flex items-center gap-1.5 text-sm text-neutral-800 dark:text-neutral-200 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
            title={locked ? "At least one platform must stay selected" : undefined}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={locked}
              onChange={(e) => toggle(platform, e.target.checked)}
              className="h-4 w-4 rounded border-neutral-500 accent-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:accent-indigo-400 dark:focus-visible:outline-indigo-400"
            />
            {PLATFORM_LABELS[platform]}
          </label>
        );
      })}
      {onlyOne && (
        <span id={hintId} className="sr-only">
          At least one platform must stay selected.
        </span>
      )}
    </fieldset>
  );
}
