import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import YouTubeContentFetcherPlugin from "./main";
import { AddChannelModal } from "./addChannelModal";
import { YouTubeChannel } from "./types";

export class YouTubeContentFetcherSettingTab extends PluginSettingTab {
  plugin: YouTubeContentFetcherPlugin;

  constructor(app: App, plugin: YouTubeContentFetcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Crawler 設定" });

    // ─── 全般設定セクション ───────────────────────────────────────

    containerEl.createEl("h3", { text: "全般設定" });

    new Setting(containerEl)
      .setName("YouTube API Key")
      .setDesc("YouTube Data API v3 のAPIキーを入力してください。")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("AIzaSy...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("デフォルト保存先フォルダ")
      .setDesc("生成されたノートを保存するフォルダパスを指定してください。")
      .addText((text) =>
        text
          .setPlaceholder("Sources")
          .setValue(this.plugin.settings.defaultSaveFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultSaveFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("デフォルトステータス名")
      .setDesc("新規作成されたノートの初期ステータスを設定してください。")
      .addText((text) =>
        text
          .setPlaceholder("未確認")
          .setValue(this.plugin.settings.defaultStatus)
          .onChange(async (value) => {
            this.plugin.settings.defaultStatus = value;
            await this.plugin.saveSettings();
          })
      );

    // ─── YouTubeチャンネル管理 ────────────────────────────────────

    containerEl.createEl("h3", { text: "YouTubeチャンネル管理" });

    const channelListContainer = containerEl.createDiv({ cls: "ytcf-channel-list-container" });
    this.renderChannelList(channelListContainer);

    new Setting(containerEl)
      .setName("チャンネルを追加")
      .setDesc("新しいYouTubeチャンネルを登録します。")
      .addButton((button) =>
        button.setButtonText("チャンネルを追加").setCta().onClick(() => {
          new AddChannelModal(this.app, this.plugin.settings.apiKey, async (channel: YouTubeChannel) => {
            const exists = this.plugin.settings.channels.some((ch) => ch.id === channel.id);
            if (exists) {
              new Notice(`チャンネルID「${channel.id}」は既に登録されています。`);
              return;
            }
            this.plugin.settings.channels.push(channel);
            await this.plugin.saveSettings();
            channelListContainer.empty();
            this.renderChannelList(channelListContainer);
            new Notice(`チャンネル「${channel.name}」を追加しました。`);
          }).open();
        })
      );

    // ─── Obsidian アップデート情報 ────────────────────────────────

    containerEl.createEl("h3", { text: "Obsidian アップデート情報" });

    new Setting(containerEl)
      .setName("アップデート情報の取得を有効にする")
      .setDesc("obsidian.md/changelog.xml から直近1ヶ月のアップデート情報を取得します。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fetchObsidianUpdates)
          .onChange(async (value) => {
            this.plugin.settings.fetchObsidianUpdates = value;
            await this.plugin.saveSettings();
          })
      );

    // ─── O'Reilly 近刊情報 ────────────────────────────────────────

    containerEl.createEl("h3", { text: "O'Reilly 近刊情報" });

    new Setting(containerEl)
      .setName("近刊情報の取得を有効にする")
      .setDesc("oreilly.co.jp/catalog/soon.xml から直近1ヶ月の近刊情報を取得します。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fetchOReillyBooks)
          .onChange(async (value) => {
            this.plugin.settings.fetchOReillyBooks = value;
            await this.plugin.saveSettings();
          })
      );

  }

  private renderChannelList(container: HTMLElement) {
    container.empty();

    if (this.plugin.settings.channels.length === 0) {
      container.createEl("p", { text: "登録されているチャンネルはありません。", cls: "ytcf-empty-msg" });
      return;
    }

    this.plugin.settings.channels.forEach((channel, index) => {
      const row = container.createDiv({ cls: "ytcf-channel-row" });
      const info = row.createDiv({ cls: "ytcf-channel-info" });
      info.createEl("span", { text: channel.name, cls: "ytcf-channel-name" });
      info.createEl("span", { text: ` (${channel.id})`, cls: "ytcf-channel-id" });

      const deleteButton = row.createEl("button", { text: "削除", cls: "ytcf-delete-btn" });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.channels.splice(index, 1);
        await this.plugin.saveSettings();
        this.renderChannelList(container);
        new Notice(`チャンネル「${channel.name}」を削除しました。`);
      });
    });
  }
}
