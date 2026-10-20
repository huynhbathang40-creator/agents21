import type { Platform } from "../../../../shared/types";
import * as instagram from "./instagram";
import * as tiktok from "./tiktok";
import type { Connector } from "./types";
import * as youtube from "./youtube";

export type { Connector, ConnectorResult, SearchOptions, TrendingOptions } from "./types";

export const connectors: Record<Platform, Connector> = {
  tiktok: { platform: "tiktok", trending: tiktok.trending, searchKeyword: tiktok.searchKeyword, searchHashtag: tiktok.searchHashtag },
  instagram: {
    platform: "instagram",
    trending: instagram.trending,
    searchKeyword: instagram.searchKeyword,
    searchHashtag: instagram.searchHashtag,
  },
  youtube: { platform: "youtube", trending: youtube.trending, searchKeyword: youtube.searchKeyword, searchHashtag: youtube.searchHashtag },
};
