// Shared between the SPA and Netlify Functions. See docs/PRD.md §7.

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface Video {
  id: string;
  platform: Platform;
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  author: { handle: string; displayName?: string; avatarUrl?: string; url?: string };
  stats: { views?: number; likes?: number; comments?: number; shares?: number };
  postedAt?: string;
  durationSec?: number;
  hashtags?: string[];
  music?: { title?: string; author?: string };
}

export interface PlatformError {
  platform: Platform;
  message: string;
}

export interface SearchResponse {
  results: Video[];
  errors: PlatformError[];
  cursors: Partial<Record<Platform, string>>;
  cached: boolean;
}
