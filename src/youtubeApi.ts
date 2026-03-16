import { requestUrl } from "obsidian";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export interface VideoItem {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

async function get(url: string): Promise<any> {
  const res = await requestUrl({ url, throw: false });
  if (res.status === 400) throw new Error("APIキーが正しくありません");
  if (res.status !== 200) throw new Error(`APIエラー (${res.status})`);
  return res.json;
}

export async function fetchUploadsPlaylistId(
  channelId: string,
  apiKey: string
): Promise<string> {
  const params = new URLSearchParams({ part: "contentDetails", id: channelId, key: apiKey });
  const data = await get(`${BASE_URL}/channels?${params}`);

  if (!data.items || data.items.length === 0) {
    throw new Error(`チャンネルが見つかりません (${channelId})`);
  }
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

export async function fetchRecentVideos(
  uploadsPlaylistId: string,
  apiKey: string,
  onPage?: (fetched: number) => void
): Promise<VideoItem[]> {
  const videos: VideoItem[] = [];
  let pageToken: string | undefined;
  const MAX_PAGES = 10;
  const since = new Date();
  since.setMonth(since.getMonth() - 1);

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await get(`${BASE_URL}/playlistItems?${params}`);

    let reachedOld = false;
    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId) continue;

      const publishedAt = snippet.publishedAt ?? "";
      if (publishedAt && new Date(publishedAt) < since) {
        reachedOld = true;
        break;
      }

      videos.push({
        videoId,
        title: snippet.title ?? "無題",
        description: snippet.description ?? "",
        publishedAt,
        thumbnailUrl:
          snippet.thumbnails?.maxres?.url ??
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.medium?.url ??
          snippet.thumbnails?.default?.url ??
          "",
      });
    }

    onPage?.(videos.length);

    if (reachedOld || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return videos;
}
