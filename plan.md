# レシート割り勘計算ツール

## 概要
日本のレシートをアップロードして解析し、チェックした項目の合計金額を計算するWebツール。
静的ファイルのみで動作（サーバー不要）。

## 機能仕様

### 画面構成
1. **API Key入力エリア**
   - API Key入力欄（password型）
   - 保存ボタン（localStorageに保存）

2. **アップロードエリア**
   - 画像アップロードボタン（タップで選択）
   - 対応形式: JPG, PNG

3. **解析結果表示エリア**
   - 各項目（商品名、金額）とチェックボックス
   - チェックされた項目の合計を動的に計算・表示

4. **税率選択**
   - ラジオボタン: 税込(+0%), 軽減税(+8%), 税(+10%)
   - デフォルト: 税込(+0%)

5. **合計金額表示**
   - チェックされた項目の合計 × 税率
   - クリップボードにコピーするボタン

## 技術仕様

### API連携 (TabScanner)
- **アップロード**: `POST https://api.tabscanner.com/api/2/process`
  - Headers: `apikey: {API_KEY}`
  - Body: multipart/form-data (file, documentType: "receipt", region: "jp")
  - Response: `{ token: string }`

- **結果取得**: `GET https://api.tabscanner.com/api/result/{token}`
  - Headers: `apikey: {API_KEY}`
  - ポーリング間隔: 1秒
  - Response: lineItems配列に各項目の情報

## ファイル構成
```
receipt-calculator/
├── plan.md
├── package.json
├── .gitignore
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## 使い方
1. `public/index.html` をブラウザで開く
2. TabScanner API Keyを入力して「保存」
3. レシート画像をアップロード
4. 解析結果から項目をチェック
5. 合計金額を確認・コピー
