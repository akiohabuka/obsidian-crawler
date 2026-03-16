import { Plugin, Notice } from "obsidian";
import { YouTubeContentFetcherSettings, DEFAULT_SETTINGS } from "./types";
import { YouTubeContentFetcherSettingTab } from "./settingsTab";
import { FetcherModal } from "./fetcherModal";

export default class YouTubeContentFetcherPlugin extends Plugin {
  settings: YouTubeContentFetcherSettings;

  async onload() {
    await this.loadSettings();

    // ─── リボンアイコン登録 ────────────────────────────────────────
    this.addRibbonIcon("download", "YouTube Content Fetcher", () => {
      this.openFetcherModal();
    });

    // ─── コマンドパレット登録 ─────────────────────────────────────
    this.addCommand({
      id: "open-settings",
      name: "Fetcher: Open Settings",
      callback: () => {
        // 設定タブを開く（Obsidian の設定画面を開く）
        // @ts-ignore - openTab は内部 API だが広く使われている
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById("youtube-content-fetcher");
      },
    });

    this.addCommand({
      id: "run-fetcher",
      name: "Fetcher: Run Fetcher",
      callback: () => {
        this.openFetcherModal();
      },
    });

    // ─── 設定タブ登録 ─────────────────────────────────────────────
    this.addSettingTab(new YouTubeContentFetcherSettingTab(this.app, this));

    console.log("YouTube Content Fetcher plugin loaded.");
  }

  onunload() {
    console.log("YouTube Content Fetcher plugin unloaded.");
  }

  // ─── 設定の読み書き ────────────────────────────────────────────

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ─── モーダルを開く ────────────────────────────────────────────

  openFetcherModal() {
    if (!this.settings.apiKey) {
      new Notice("APIエラー: APIキーを確認してください");
      return;
    }
    new FetcherModal(this.app, this.settings).open();
  }
}
