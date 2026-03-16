# Obsidian Crawler

YouTube チャンネル・O'Reilly 近刊・Obsidian アップデート情報を自動収集し、Obsidian ノートとして保存する Obsidian プラグインです。

## 機能

- **YouTube** — 登録チャンネルの直近1ヶ月の動画をノート化
- **O'Reilly 近刊** — oreilly.co.jp の新刊情報（サムネイル・価格・目次付き）をノート化
- **Obsidian アップデート情報** — obsidian.md の Changelog を直近1ヶ月分ノート化

今後もソースをゆるく追加予定。

## インストール

1. [Releases](https://github.com/akiohabuka/obsidian-crawler/releases) から最新の `main.js`・`manifest.json`・`styles.css` をダウンロード
2. Vault の `.obsidian/plugins/obsidian-crawler/` に配置
3. Obsidian の設定 → コミュニティプラグイン → Obsidian Crawler を有効化

## 設定

| 項目 | 説明 |
|------|------|
| YouTube API Key | YouTube Data API v3 のキー（[取得方法](https://developers.google.com/youtube/v3/getting-started)） |
| 保存先フォルダ | ノートを保存するフォルダパス（デフォルト: `Sources`） |
| デフォルトステータス | 新規ノートの初期ステータス（デフォルト: `未確認`） |
| YouTubeチャンネル管理 | `@ハンドル` でチャンネルを追加・削除 |
| Obsidian アップデート情報 | 取得の有効/無効 |
| O'Reilly 近刊情報 | 取得の有効/無効 |

## 使い方

1. 左リボンの Crawler アイコン、またはコマンドパレットから `Fetch Content` を実行
2. 取得するソースをチェックして「Fetch開始」
3. 完了後、指定フォルダにノートが生成される

## ノートのフォーマット

各ノートはフロントマターに `source` / `url` / `published_at` / `thumbnail` / `status` を持ち、重複チェックは `video_id`（YouTube）または `url`（その他）で行います。

## 開発

```bash
npm install
npm run build   # ビルド
npm run dev     # ウォッチモード
```
