# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

地方自治体（都道府県・市区町村）の予算データを収集し、地図上に可視化するアプリケーション。モノレポ構成で2つのアプリを管理。

## Commands

```bash
# 依存関係インストール
npm install

# データ取得（Japan Dashboardの公式CSVをインポート — 推奨）
npm run -w @local-gov/crawler import:dashboard

# 旧クローラー（PDFスクレイピング。公式CSV移行により通常は不要）
npm run -w @local-gov/crawler crawl:prefecture  # 都道府県のみ
npm run -w @local-gov/crawler crawl:city        # 市区町村のみ

# Web開発サーバー
npm run web

# ビルド
npm run build

# Lint
npm run lint

# 型チェック
npm run -w @local-gov/crawler typecheck
npm run -w @local-gov/web typecheck
```

## Architecture

```
local_gov_crawler/
├── apps/
│   ├── crawler/          # データ収集（Node.js + Playwright）
│   │   └── src/
│   │       ├── crawlers/ # クローラー実装（prefecture.ts, city.ts）
│   │       ├── data/     # 静的データ（都道府県コード等）
│   │       └── types/    # 型定義
│   └── web/              # 可視化（Next.js + Leaflet）
│       └── src/
│           ├── app/      # App Router
│           ├── components/
│           └── types/
├── data/
│   ├── budgets/          # クロール済み予算データ（JSON）
│   └── geo/              # GeoJSONファイル
└── packages/             # 共有パッケージ（将来用）
```

## Data Flow

1. **Importer** (`import-dashboard.ts`) → デジタル庁 Japan Dashboard の地方財政CSV（総務省・地方財政状況調査の決算データ、2020〜2024年度）をダウンロード・変換 → `data/budgets/prefectures.json` と `apps/web/public/budgets.json`
2. **Web** → JSONデータ読み込み → GeoJSONと結合 → Leaflet地図で描画（年度・指標切替あり）

データ利用時は出典記載が必須: 「Japan Dashboard 地方財政（都道府県ごと）／デジタル庁・総務省」（サイドバーに表示済み）。
旧Playwrightクローラー（`crawlers/`）とPDF/VLM抽出（`extractors/`, `*.py`）は公式CSV移行により非推奨。

## Key Types

`LocalGovBudget`: 予算データの中心的な型。自治体コード（JIS X 0401/0402）、歳入歳出、カテゴリ別内訳を含む。

## Notes

- 都道府県コードはJIS X 0401準拠（01:北海道〜47:沖縄）
- 金額は円単位で保存、表示時に億/兆に変換
- クローラーはレート制限対策で1秒間隔
- Leafletはクライアントサイドのみで動作（`dynamic import`使用）
- Webアプリは静的エクスポート対応（`output: 'export'`）
