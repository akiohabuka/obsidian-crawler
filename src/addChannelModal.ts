import { App, Modal, Setting, Notice, requestUrl } from "obsidian";
import { YouTubeChannel } from "./types";

export class AddChannelModal extends Modal {
  private input: string = "";
  private apiKey: string;
  private onSubmit: (channel: YouTubeChannel) => void;

  constructor(
    app: App,
    apiKey: string,
    onSubmit: (channel: YouTubeChannel) => void
  ) {
    super(app);
    this.apiKey = apiKey;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "チャンネルを追加" });

    // 入力フィールド
    let inputEl: HTMLInputElement;
    new Setting(contentEl)
      .setName("チャンネルハンドル")
      .setDesc("@ハンドル名を入力してください（例: @AI-geboku）")
      .addText((text) => {
        inputEl = text.inputEl;
        text
          .setPlaceholder("@AI-geboku")
          .onChange((value) => {
            this.input = value.trim();
          });
        setTimeout(() => text.inputEl.focus(), 50);
      });

    // プレビューエリア（解決後に表示）
    const previewEl = contentEl.createDiv({ cls: "ytcf-channel-preview ytcf-hidden" });

    const buttonContainer = contentEl.createDiv({ cls: "ytcf-modal-buttons" });

    // 検索ボタン
    const searchButton = buttonContainer.createEl("button", {
      text: "チャンネルを検索",
      cls: "mod-cta",
    });

    // 追加ボタン（検索後に有効化）
    const addButton = buttonContainer.createEl("button", {
      text: "追加",
      cls: "mod-cta ytcf-hidden",
    });

    const cancelButton = buttonContainer.createEl("button", {
      text: "キャンセル",
    });

    // 解決済みチャンネル（検索後に保持）
    let resolvedChannel: YouTubeChannel | null = null;

    searchButton.addEventListener("click", async () => {
      if (!this.input) return;

      if (!this.apiKey) {
        new Notice("APIエラー: 設定画面でAPIキーを入力してください。");
        return;
      }

      searchButton.disabled = true;
      searchButton.setText("検索中...");
      previewEl.addClass("ytcf-hidden");
      addButton.addClass("ytcf-hidden");
      resolvedChannel = null;

      try {
        resolvedChannel = await this.resolveChannel(this.input);

        previewEl.empty();
        previewEl.removeClass("ytcf-hidden");
        previewEl.createEl("p", {
          text: `チャンネル名: ${resolvedChannel.name}`,
          cls: "ytcf-preview-name",
        });
        previewEl.createEl("p", {
          text: `チャンネルID: ${resolvedChannel.id}`,
          cls: "ytcf-preview-id",
        });
        addButton.removeClass("ytcf-hidden");
      } catch (e) {
        new Notice(e.message);
      } finally {
        searchButton.disabled = false;
        searchButton.setText("チャンネルを検索");
      }
    });

    addButton.addEventListener("click", () => {
      if (!resolvedChannel) return;
      this.onSubmit(resolvedChannel);
      this.close();
    });

    cancelButton.addEventListener("click", () => {
      this.close();
    });
  }

  private async resolveChannel(input: string): Promise<YouTubeChannel> {
    // @ を除いて forHandle に渡す
    const handle = input.startsWith("@") ? input.slice(1) : input;

    const params = new URLSearchParams({
      part: "snippet",
      key: this.apiKey,
      maxResults: "1",
    });

    params.set("forHandle", handle);

    const url = `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
    // throw: false で 4xx/5xx でも例外を投げずにレスポンスを返す
    const response = await requestUrl({ url, throw: false });

    if (response.status === 400) {
      throw new Error("APIキーが正しくありません");
    }
    if (response.status !== 200) {
      throw new Error(`APIエラー (${response.status})`);
    }

    const data = response.json;
    if (!data.items || data.items.length === 0) {
      throw new Error("チャンネルが見つかりませんでした");
    }

    const item = data.items[0];
    return {
      id: item.id,
      name: item.snippet.title,
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
