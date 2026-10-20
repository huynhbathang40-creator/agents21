import type { Platform, Video } from "../../../../shared/types";

export interface ConnectorResult {
  videos: Video[];
  /** Opaque value to pass back as `cursor` for the next page; undefined when there is none. */
  nextCursor?: string;
}

/** Optional cancellation shared by every connector call (e.g. client disconnect). */
interface CallOptions {
  signal?: AbortSignal;
}

export interface TrendingOptions extends CallOptions {
  region?: string;
}

export interface SearchOptions extends CallOptions {
  cursor?: string;
}

export interface Connector {
  platform: Platform;
  trending(opts?: TrendingOptions): Promise<ConnectorResult>;
  searchKeyword(query: string, opts?: SearchOptions): Promise<ConnectorResult>;
  searchHashtag(tag: string, opts?: SearchOptions): Promise<ConnectorResult>;
}
