import { App, Modal, Notice } from "obsidian";
import { YouTubeChannel, FetchResult, YouTubeContentFetcherSettings } from "./types";
import { fetchUploadsPlaylistId, fetchRecentVideos, VideoItem } from "./youtubeApi";
import { fetchRecentRSSItems, fetchOReillyBookDetails, RSSItem, BookDetails } from "./rssApi";

const OBSIDIAN_CHANGELOG_URL = "https://obsidian.md/changelog.xml";
const OBSIDIAN_THUMBNAIL_URL = "https://www.unipos.net/wp-content/uploads/obsidian1.png";
const OREILLY_FEED_URL = "https://www.oreilly.co.jp/catalog/soon.xml";

type FetchSource =
  | { type: "youtube"; channel: YouTubeChannel }
  | { type: "obsidian" }
  | { type: "oreilly" };

export class FetcherModal extends Modal {
  private settings: YouTubeContentFetcherSettings;
  private selectedKeys: Set<string> = new Set();
  private selectAll: boolean = true;

  private progressBar: HTMLProgressElement | null = null;
  private progressText: HTMLSpanElement | null = null;
  private logArea: HTMLDivElement | null = null;

  constructor(app: App, settings: YouTubeContentFetcherSettings) {
    super(app);
    this.settings = settings;
    this.allSources().forEach((s) => this.selectedKeys.add(this.sourceKey(s)));
  }

  private allSources(): FetchSource[] {
    return [
      ...this.settings.channels.map((ch): FetchSource => ({ type: "youtube", channel: ch })),
      ...(this.settings.fetchObsidianUpdates ? [{ type: "obsidian" } as FetchSource] : []),
      ...(this.settings.fetchOReillyBooks ? [{ type: "oreilly" } as FetchSource] : []),
    ];
  }

  private sourceKey(s: FetchSource): string {
    if (s.type === "youtube") return `yt:${s.channel.id}`;
    if (s.type === "obsidian") return "obsidian";
    return "oreilly";
  }

  private sourceLabel(s: FetchSource): string {
    if (s.type === "youtube") return `[YouTube] ${s.channel.name}`;
    if (s.type === "obsidian") return "[Obsidian] アップデート情報";
    return "[O'Reilly] 近刊情報";
  }

  onOpen() { this.renderConfirmPhase(); }
  onClose() { this.contentEl.empty(); }

  // ─── 実行前確認画面 ────────────────────────────────────────────

  private renderConfirmPhase() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "コンテンツの取得" });

    const allRow = contentEl.createDiv({ cls: "ytcf-check-row" });
    const allCheckbox = allRow.createEl("input", { type: "checkbox" });
    allCheckbox.id = "ytcf-select-all";
    allCheckbox.checked = this.selectAll;
    const allLabel = allRow.createEl("label", { text: "すべてのソース" });
    allLabel.htmlFor = "ytcf-select-all";

    const sourceList = contentEl.createDiv({ cls: "ytcf-channel-list" });
    const sources = this.allSources();
    const individualCheckboxes: HTMLInputElement[] = [];

    if (sources.length === 0) {
      sourceList.createEl("p", {
        text: "登録されているソースがありません。設定からチャンネルを追加するか、Obsidianアップデート情報を有効にしてください。",
        cls: "ytcf-empty-msg",
      });
    } else {
      sources.forEach((source) => {
        const key = this.sourceKey(source);
        const row = sourceList.createDiv({ cls: "ytcf-check-row ytcf-indent" });
        const checkbox = row.createEl("input", { type: "checkbox" });
        checkbox.id = `ytcf-src-${key}`;
        checkbox.checked = this.selectedKeys.has(key);
        const label = row.createEl("label", { text: this.sourceLabel(source) });
        label.htmlFor = `ytcf-src-${key}`;

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) { this.selectedKeys.add(key); }
          else { this.selectedKeys.delete(key); }
          allCheckbox.checked = individualCheckboxes.every((cb) => cb.checked);
          this.selectAll = allCheckbox.checked;
        });

        individualCheckboxes.push(checkbox);
      });
    }

    allCheckbox.addEventListener("change", () => {
      this.selectAll = allCheckbox.checked;
      individualCheckboxes.forEach((cb) => { cb.checked = allCheckbox.checked; });
      if (allCheckbox.checked) { sources.forEach((s) => this.selectedKeys.add(this.sourceKey(s))); }
      else { this.selectedKeys.clear(); }
    });

    const buttonContainer = contentEl.createDiv({ cls: "ytcf-modal-buttons" });

    const fetchButton = buttonContainer.createEl("button", { text: "Fetch開始", cls: "mod-cta" });
    fetchButton.addEventListener("click", () => {
      const targets = sources.filter((s) => this.selectedKeys.has(this.sourceKey(s)));
      if (targets.length === 0) {
        new Notice("取得するソースを選択してください。");
        return;
      }
      this.renderRunningPhase(targets);
    });

    const cancelButton = buttonContainer.createEl("button", { text: "キャンセル" });
    cancelButton.addEventListener("click", () => { this.close(); });
  }

  // ─── 実行中・結果画面 ─────────────────────────────────────────

  private renderRunningPhase(targets: FetchSource[]) {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "取得中..." });

    const progressWrapper = contentEl.createDiv({ cls: "ytcf-progress-wrapper" });
    this.progressBar = progressWrapper.createEl("progress");
    this.progressBar.max = 100;
    this.progressBar.value = 0;
    this.progressText = progressWrapper.createEl("span", { text: "0%" });

    contentEl.createEl("p", { text: "ステータスログ:", cls: "ytcf-log-label" });
    this.logArea = contentEl.createDiv({ cls: "ytcf-log-area" });

    this.runFetch(targets).then((result) => {
      this.renderDonePhase(result);
    }).catch((e) => {
      this.addLog(`[エラー] ${e.message}`);
      this.renderDonePhase({ created: 0, skipped: 0, errors: [e.message] });
    });
  }

  private renderDonePhase(result: FetchResult) {
    const { contentEl } = this;

    const h2 = contentEl.querySelector("h2");
    if (h2) h2.textContent = "取得完了";

    const summary = contentEl.createDiv({ cls: "ytcf-summary" });
    summary.createEl("p", {
      text: `新規作成: ${result.created} 件 / スキップ: ${result.skipped} 件 / エラー: ${result.errors.length} 件`,
    });

    const buttonContainer = contentEl.createDiv({ cls: "ytcf-modal-buttons" });
    const closeButton = buttonContainer.createEl("button", { text: "閉じる", cls: "mod-cta" });
    closeButton.addEventListener("click", () => { this.close(); });

    new Notice(`取得完了: 新規 ${result.created}件、スキップ ${result.skipped}件`);
  }

  // ─── バックエンド実装 ─────────────────────────────────────────

  private async runFetch(targets: FetchSource[]): Promise<FetchResult> {
    new Notice("コンテンツ取得を開始しました...");

    const result: FetchResult = { created: 0, skipped: 0, errors: [] };
    const existingVideoIds = this.getExistingFrontmatterValues("video_id");
    const existingUrls = this.getExistingFrontmatterValues("url");

    await this.ensureFolder(this.settings.defaultSaveFolder);

    for (let i = 0; i < targets.length; i++) {
      const source = targets[i];
      this.updateProgress(Math.round((i / targets.length) * 100));

      if (source.type === "youtube") {
        await this.fetchYouTube(source.channel, existingVideoIds, result);
      } else if (source.type === "obsidian") {
        await this.fetchObsidianUpdates(existingUrls, result);
      } else if (source.type === "oreilly") {
        await this.fetchOReillyBooks(existingUrls, result);
      }

      this.updateProgress(Math.round(((i + 1) / targets.length) * 100));
    }

    this.updateProgress(100);
    return result;
  }

  private async fetchYouTube(
    channel: YouTubeChannel,
    existingIds: Set<string>,
    result: FetchResult
  ): Promise<void> {
    this.addLog(`[YouTube] チャンネル「${channel.name}」をスキャン中...`);
    try {
      const playlistId = await fetchUploadsPlaylistId(channel.id, this.settings.apiKey);
      const videos = await fetchRecentVideos(playlistId, this.settings.apiKey, (fetched) => {
        this.addLog(`[YouTube] ${fetched} 件の動画情報を取得中...`);
      });
      this.addLog(`[YouTube] ${videos.length} 件の動画が見つかりました`);

      for (const video of videos) {
        if (existingIds.has(video.videoId)) {
          this.addLog(`[スキップ] ${video.title} (取得済み)`);
          result.skipped++;
          continue;
        }
        try {
          await this.createYouTubeNote(video);
          existingIds.add(video.videoId);
          this.addLog(`[作成] ${video.title}`);
          result.created++;
        } catch (e) {
          this.addLog(`[エラー] ${video.title}: ${e.message}`);
          result.errors.push(`${video.title}: ${e.message}`);
        }
      }
    } catch (e) {
      this.addLog(`[エラー] ${channel.name}: ${e.message}`);
      result.errors.push(`${channel.name}: ${e.message}`);
    }
  }

  private async fetchObsidianUpdates(
    existingUrls: Set<string>,
    result: FetchResult
  ): Promise<void> {
    this.addLog("[Obsidian] アップデート情報をスキャン中...");
    try {
      const items = await fetchRecentRSSItems(OBSIDIAN_CHANGELOG_URL);
      const thumbnailUrl = OBSIDIAN_THUMBNAIL_URL;
      this.addLog(`[Obsidian] ${items.length} 件のアップデートが見つかりました`);

      for (const item of items) {
        if (existingUrls.has(item.url)) {
          this.addLog(`[スキップ] ${item.title} (取得済み)`);
          result.skipped++;
          continue;
        }
        try {
          await this.createObsidianNote(item, thumbnailUrl);
          existingUrls.add(item.url);
          this.addLog(`[作成] ${item.title}`);
          result.created++;
        } catch (e) {
          this.addLog(`[エラー] ${item.title}: ${e.message}`);
          result.errors.push(`${item.title}: ${e.message}`);
        }
      }
    } catch (e) {
      this.addLog(`[エラー] Obsidianアップデート情報: ${e.message}`);
      result.errors.push(`Obsidianアップデート情報: ${e.message}`);
    }
  }

  private async fetchOReillyBooks(
    existingUrls: Set<string>,
    result: FetchResult
  ): Promise<void> {
    this.addLog("[O'Reilly] 近刊情報をスキャン中...");
    try {
      const items = await fetchRecentRSSItems(OREILLY_FEED_URL);
      this.addLog(`[O'Reilly] ${items.length} 件の近刊が見つかりました`);

      for (const item of items) {
        if (existingUrls.has(item.url)) {
          this.addLog(`[スキップ] ${item.title} (取得済み)`);
          result.skipped++;
          continue;
        }
        try {
          const details = await fetchOReillyBookDetails(item.url);
          await this.createOReillyNote(item, details);
          existingUrls.add(item.url);
          this.addLog(`[作成] ${item.title}`);
          result.created++;
        } catch (e) {
          this.addLog(`[エラー] ${item.title}: ${e.message}`);
          result.errors.push(`${item.title}: ${e.message}`);
        }
      }
    } catch (e) {
      this.addLog(`[エラー] O'Reilly近刊情報: ${e.message}`);
      result.errors.push(`O'Reilly近刊情報: ${e.message}`);
    }
  }

  // ─── Vault操作 ────────────────────────────────────────────────

  private getExistingFrontmatterValues(key: string): Set<string> {
    const values = new Set<string>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      const val = cache?.frontmatter?.[key];
      if (val) values.add(String(val));
    }
    return values;
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(folderPath)) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  private async createYouTubeNote(video: VideoItem): Promise<void> {
    const safeName = video.title.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = `${this.settings.defaultSaveFolder}/${safeName}.md`;
    const publishedDate = video.publishedAt ? video.publishedAt.split("T")[0] : "";

    const content = `---
source: youtube
video_id: ${video.videoId}
published_at: ${publishedDate}
url: "https://www.youtube.com/watch?v=${video.videoId}"
thumbnail: "${video.thumbnailUrl}"
status: ${this.settings.defaultStatus}
tags:
  - content
  - youtube
---
## 概要
${video.description ? this.cleanText(video.description) : "(概要なし)"}

---

## メモ
`;
    await this.app.vault.create(filePath, content);
  }

  private async createObsidianNote(item: RSSItem, thumbnailUrl: string): Promise<void> {
    const safeName = item.title.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = `${this.settings.defaultSaveFolder}/${safeName}.md`;
    const publishedDate = item.publishedAt ? new Date(item.publishedAt).toISOString().split("T")[0] : "";

    const content = `---
source: obsidian
published_at: ${publishedDate}
url: "${item.url}"
thumbnail: "${thumbnailUrl}"
status: ${this.settings.defaultStatus}
tags:
  - content
  - obsidian
---
## 概要
${item.description ? this.cleanText(item.description, true) : "(概要なし)"}

---

## メモ
`;
    await this.app.vault.create(filePath, content);
  }

  private async createOReillyNote(item: RSSItem, details: BookDetails): Promise<void> {
    const safeName = item.title.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = `${this.settings.defaultSaveFolder}/${safeName}.md`;
    const publishedDate = details.publishedAt || (item.publishedAt ? new Date(item.publishedAt).toISOString().split("T")[0] : "");

    const content = `---
source: oreilly
published_at: ${publishedDate}
url: "${item.url}"
thumbnail: "${details.thumbnail}"
price: "${details.price}"
status: ${this.settings.defaultStatus}
tags:
  - content
  - oreilly
---
${details.thumbnail ? `![Thumbnail](${details.thumbnail})\n` : ""}## 概要
${item.description ? this.cleanText(item.description, true) : "(概要なし)"}

## 目次
${details.toc || "(目次なし)"}

---

## メモ
`;
    await this.app.vault.create(filePath, content);
  }

  // ─── テキスト整形 ─────────────────────────────────────────────

  private cleanText(text: string, isHtml = false): string {
    let cleaned = text;
    if (isHtml) {
      cleaned = cleaned
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n")
        .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, "**$2**")
        .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "*$2*")
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
        .replace(/<ul[^>]*>/gi, "")
        .replace(/<ol[^>]*>/gi, "")
        .replace(/<\/ul>/gi, "\n")
        .replace(/<\/ol>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#?\w+;/g, "");
    }
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
  }

  // ─── UI ヘルパー ──────────────────────────────────────────────

  private addLog(message: string) {
    if (!this.logArea) return;
    const line = this.logArea.createEl("div", { text: message, cls: "ytcf-log-line" });
    line.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  private updateProgress(percent: number) {
    if (this.progressBar) this.progressBar.value = percent;
    if (this.progressText) this.progressText.textContent = `${percent}%`;
  }
}
