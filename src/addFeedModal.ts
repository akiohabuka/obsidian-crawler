import { App, Modal, Setting, Notice } from "obsidian";
import { RSSFeed } from "./types";
import { fetchFeedTitle } from "./rssApi";

export class AddFeedModal extends Modal {
  private url: string = "";
  private onSubmit: (feed: RSSFeed) => void;

  constructor(app: App, onSubmit: (feed: RSSFeed) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "RSSフィードを追加" });

    new Setting(contentEl)
      .setName("フィードURL")
      .setDesc("RSSまたはAtomフィードのURLを入力してください。")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com/feed.xml")
          .onChange((value) => { this.url = value.trim(); });
        setTimeout(() => text.inputEl.focus(), 50);
      });

    const previewEl = contentEl.createDiv({ cls: "ytcf-channel-preview ytcf-hidden" });

    const buttonContainer = contentEl.createDiv({ cls: "ytcf-modal-buttons" });

    const searchButton = buttonContainer.createEl("button", {
      text: "フィードを確認",
      cls: "mod-cta",
    });

    const addButton = buttonContainer.createEl("button", {
      text: "追加",
      cls: "mod-cta ytcf-hidden",
    });

    const cancelButton = buttonContainer.createEl("button", { text: "キャンセル" });

    let resolvedFeed: RSSFeed | null = null;

    searchButton.addEventListener("click", async () => {
      if (!this.url) return;

      searchButton.disabled = true;
      searchButton.setText("確認中...");
      previewEl.addClass("ytcf-hidden");
      addButton.addClass("ytcf-hidden");
      resolvedFeed = null;

      try {
        const name = await fetchFeedTitle(this.url);
        resolvedFeed = { url: this.url, name };

        previewEl.empty();
        previewEl.removeClass("ytcf-hidden");
        previewEl.createEl("p", { text: `フィード名: ${name}`, cls: "ytcf-preview-name" });
        previewEl.createEl("p", { text: `URL: ${this.url}`, cls: "ytcf-preview-id" });
        addButton.removeClass("ytcf-hidden");
      } catch (e) {
        new Notice(e.message);
      } finally {
        searchButton.disabled = false;
        searchButton.setText("フィードを確認");
      }
    });

    addButton.addEventListener("click", () => {
      if (!resolvedFeed) return;
      this.onSubmit(resolvedFeed);
      this.close();
    });

    cancelButton.addEventListener("click", () => { this.close(); });
  }

  onClose() {
    this.contentEl.empty();
  }
}
