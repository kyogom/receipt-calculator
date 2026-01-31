# レシート割り勘計算ツール

レシート画像をアップロードして解析し、項目ごとに割り勘・立替を選択して合計金額を計算するWebツール。

## 機能

- レシート画像をTabScanner APIで解析
- 各項目を「割勘」「立替」「除外」から選択
  - 割勘: 金額をそのまま加算
  - 立替: 金額×2で加算
  - 除外: 計算から除外
- 税率選択（税込/軽減税8%/税10%）
- 合計金額をクリップボードにコピー

## セットアップ

### 1. Cloudflare Workerのデプロイ（CORS対策）

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler deploy
```

デプロイ後に表示されるURL（例: `https://receipt-proxy.xxx.workers.dev`）を `public/app.js` の `WORKER_URL` に設定。

### 2. フロントエンドのデプロイ

#### Cloudflare Pages（推奨）

```bash
npx wrangler pages deploy public --project-name=receipt-calculator
```

#### Netlify

https://app.netlify.com/drop にアクセスして `public` フォルダをドラッグ&ドロップ。

#### ローカルで確認

```bash
npx serve public
```

## 使い方

1. TabScanner API Keyを入力して「保存」
2. レシート画像をアップロード
3. 各項目の「割勘」「立替」「除外」を選択
4. 合計金額を確認してコピー

## ファイル構成

```
receipt-calculator/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── worker/
│   ├── worker.js      # Cloudflare Worker（APIプロキシ）
│   └── wrangler.toml
└── README.md
```

## API

- [TabScanner API](https://docs.tabscanner.com/) - レシートOCR
