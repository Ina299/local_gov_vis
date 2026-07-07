# 地方自治体予算マップ

日本の地方自治体（47都道府県・約1,700市区町村）の財政・人口データを地図上で可視化するWebアプリです。

**🌐 デモ: https://ina299.github.io/local_gov_vis/**

## 機能

- **コロプレス地図**: 選択した指標の5分位で全国を塗り分け（Leaflet + 国土数値情報の行政区域境界）
- **指標カテゴリ**（ハンバーガーメニューで切替）
  - 歳入・歳出（青）: 総額／一人当たり、歳出・歳入・地方交付税の切替。2020〜2024年度の決算
  - 人口（緑）: 人口・人口密度・高齢化比率・出生数・外国人比率・外国人出生割合・増減数（増減数はマイナス=赤／プラス=青の発散配色）
  - 財政指標（赤）: 財政力指数・経常収支比率・実質公債費比率・将来負担比率（財政力指数は低いほど濃い）
- **2階層の表示粒度**: 都道府県 ⇔ 全国市区町村を右上のトグルで切替。都道府県クリック→「市区町村を表示」で県内ドリルダウンも可能
- **サイドバー**: 選択指標の値・前年度比・年度推移グラフ、歳出入の内訳（目的別・性質別）、人口統計・財政指標の一覧
- **検索**: 都道府県・市区町村名のインクリメンタル検索（左上）
- **URL共有**: 年度・指標・粒度・選択自治体がURLクエリに反映され、リンクで状態を共有可能
  - 例: [`?y=2023&m=elderlyRatio&sel=39`](https://ina299.github.io/local_gov_vis/?y=2023&m=elderlyRatio&sel=39)（2023年度・高齢化比率・高知県）

## データソース

| データ | 出典 |
|---|---|
| 財政（決算・財政指標） | [Japan Dashboard 地方財政（都道府県ごと・市町村ごと）](https://www.digital.go.jp/resources/japandashboard/prefectural-finance)／デジタル庁・総務省（地方財政状況調査） |
| 目的別歳出の財源内訳（収支図） | [地方財政状況調査 調査表「歳出内訳及び財源内訳」](https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755)（総務省・e-Stat） |
| 人口・出生・増減・外国人 | [住民基本台帳に基づく人口、人口動態及び世帯数](https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html)（総務省・令和7年1月1日） |
| 面積 | [全国都道府県市区町村別面積調](https://www.gsi.go.jp/KOKUJYOHO/MENCHO-title.htm)（国土地理院） |
| 行政区域境界 | 国土交通省 国土数値情報（行政区域）を [smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography) が1%簡略化したもの |

比率系の人口統計（高齢化比率など）は令和7年1月1日時点の静的値のため、年度切替の対象外です（選択中は年度トグルが無効になります）。

## 開発

```bash
npm install

# 開発サーバー（http://localhost:3000）
npm run web

# テスト・型チェック
npm run -w @local-gov/web test
npm run -w @local-gov/web typecheck
npm run -w @local-gov/crawler typecheck
```

### データ更新

生成済みJSONはリポジトリにコミットされているため、通常は再取得不要。更新する場合は以下の順で実行します。

```bash
npm run -w @local-gov/crawler import:dashboard      # 都道府県の財政CSV
npm run -w @local-gov/crawler import:municipal      # 市区町村の財政CSV＋境界＋検索インデックス
npm run -w @local-gov/crawler import:demographics   # 人口統計の付与＋全国市区町村用の結合データ再生成
npm run -w @local-gov/crawler import:funding        # 目的別歳出の充当一般財源等（収支図用）の付与
```

## 構成

```
apps/
├── crawler/   # データ取得・変換（Node.js + tsx）
└── web/       # 可視化（Next.js App Router + Leaflet、静的エクスポート）
```

masterへのpushで GitHub Actions が GitHub Pages へ自動デプロイします（`.github/workflows/deploy.yml`）。
