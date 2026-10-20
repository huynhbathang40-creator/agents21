import type { Platform } from "../../shared/types";

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

/** Badge colours chosen for >= 4.5:1 contrast with white text. */
export const PLATFORM_BADGE_CLASSES: Record<Platform, string> = {
  tiktok: "bg-neutral-900 text-white ring-1 ring-white/30",
  instagram: "bg-pink-700 text-white",
  youtube: "bg-red-700 text-white",
};

export const REGIONS = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
  { code: "JP", label: "Japan" },
] as const;

export type Region = (typeof REGIONS)[number]["code"];

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && REGIONS.some((r) => r.code === value);
}

/** Only TikTok's trending endpoint takes a region (FR-3). */
export function regionApplies(platform: Platform): boolean {
  return platform === "tiktok";
}
