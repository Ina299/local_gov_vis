# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

地方自治体（都道府県・市区町村）の予算データを収集し、地図上に可視化するアプリケーション。モノレポ構成で2つのアプリを管理。

## Commands

```bash
# 依存関係インストール
npm install

# データ取得（Japan Dashboardの公式CSVをインポート — 推奨）
npm run -w @local-gov/crawler import:dashboard        # 都道府県
npm run -w @local-gov/crawler import:municipal        # 市区町村（都道府県別JSON＋検索インデックス）
npm run -w @local-gov/crawler build:municipal-all     # 全国市区町村ビュー用の結合データ（import:municipal後に実行）
npm run -w @local-gov/crawler import:demographics     # 人口統計（住基・面積調、2020〜2024年度の年度別）を既存JSONに付与＋municipal-all再生成
npm run -w @local-gov/crawler import:funding          # 目的別歳出の充当一般財源等・性質別内訳（地方財政状況調査）を付与（収支図用）
npm run -w @local-gov/crawler import:employment       # 就労・所得（課税状況調・国勢調査）を付与（実行後にbuild:municipal-all再実行）
npm run -w @local-gov/crawler import:infrastructure   # インフラ（公共施設状況調: 道路・公園・公営住宅・下水道＋見える化DB: 水道管・病院＋メンテ年報: 橋梁点検）を付与＋municipal-all再生成
npm run -w @local-gov/crawler import:safety           # 安全（警察庁 交通事故オープンデータの市区町村別集計・年度別）を付与＋municipal-all再生成
npm run -w @local-gov/crawler import:crime            # 犯罪統計（刑法犯・殺人・強盗・侵入盗・不同意性交等。都道府県のみ・年度別）を付与
npm run -w @local-gov/crawler build:topo              # 境界GeoJSON（data/geo）→TopoJSONに変換してapps/web/publicへ配置（geo更新時のみ）

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

# ユニットテスト（vitest: 色分け・指標ロジック）
npm run -w @local-gov/web test
```

## Deploy

masterへのpushで `.github/workflows/deploy.yml` がGitHub Pagesへ自動デプロイする
（`NEXT_PUBLIC_BASE_PATH=/local_gov_vis` でビルド。データfetchは `lib/paths.ts` の `dataUrl()` を必ず経由すること）。
`next build` はdevサーバー起動中に実行しない（`.next` が壊れる）。

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
│   └── geo/              # 境界GeoJSONソース（build:topoがTopoJSONへ変換してwebに配置）
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
