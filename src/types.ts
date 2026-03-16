/**
 * YouTube Content Fetcher - Type Definitions
 */

export interface YouTubeChannel {
  id: string;
  name: string;
}

export interface YouTubeContentFetcherSettings {
  apiKey: string;
  defaultSaveFolder: string;
  defaultStatus: string;
  channels: YouTubeChannel[];
  fetchObsidianUpdates: boolean;
  fetchOReillyBooks: boolean;
}

export interface FetchResult {
  created: number;
  skipped: number;
  errors: string[];
}

export const DEFAULT_SETTINGS: YouTubeContentFetcherSettings = {
  apiKey: "",
  defaultSaveFolder: "Sources",
  defaultStatus: "未確認",
  channels: [],
  fetchObsidianUpdates: true,
  fetchOReillyBooks: true,
};
