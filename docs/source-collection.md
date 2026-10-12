# 原典取得を独立して再開する

既存予算・道路・選挙・評価データを変更せず、確認済みの公式 URL から原典バイト列を保存する処理です。PR #1 (`97906005a4ca1b6b3cc0b8170d232d33320bda66`) の許可リスト・内容ハッシュ・キャッシュの設計を参照し、別モジュールとして実装しています。全国版 ZIP の代替復元ではありません。

## 入力

JSON は `version: 1`, `quarantineHosts: string[]`, `sources: Source[]` を持ちます。Source の必須項目は `url`, `sourcePageUrl`, `municipalityCode`（5桁）, `municipalityName`, `title`, `fiscalYear`（不明は null）, `amountKind`（不明は null）, `review: { checkedAt, evidence }` です。`review` は既存隔離情報と照合した日時と根拠を記録します。文字列が入っているだけで安全性を証明するものではありません。既存の隔離299ホスト全体が復元できない間は、親で個別照合された URL のみを入力してください。架空の確認日時や根拠で実行しないでください。

URL はフラグメントのない正規化済み HTTPS の完全一致で指定します。ページ内リンクの探索は行いません。HTTPS の同じ厳密なホスト内のリダイレクトのみ最大4回、各応答後に待機して追従します。www の有無が異なるホストや別ホストには接続しません。新たな URL は個別に照合してキューへ追加します。隔離ドメインはサブドメインにも適用します。Google Drive と googleusercontent.com の対象は警告承認が別途必要なため停止します。

## 実行

リポジトリルートから:

```sh
npm ci --cache /workspace/npm-cache --no-audit --no-fund
node --import tsx --test apps/crawler/tests/source-collection/*.test.ts
node --import tsx apps/crawler/src/source-collection/cli.ts --queue /absolute/path/reviewed.json --output apps/crawler/output/source-collection
# dry-run の確認後に実取得（既定は通信も保存もしない）
node --import tsx apps/crawler/src/source-collection/cli.ts --queue /absolute/path/reviewed.json --output apps/crawler/output/source-collection --execute --workers 2 --delay-ms 1500
```

同じコマンドで再開すると SHA256 とサイズを照合した取得済みファイルはネットワークを使わず再利用し、未試行資料だけを取得します。ホストごとに直列実行し、応答完了後に最低1秒（既定1.5秒）空けます。別ホストの並列数は最大4です。各資料は既定20MiB・30秒を上限にします。自動リトライは行いません。HTTP エラー・別ホストへのリダイレクト・認証/アクセス/スキャン警告・通信障害は当該ホストを停止し、その状態を次の実行にも引き継ぎます。

## 既存ネットワーク設定

実取得時は Node.js 24.14 以降を使用してください。`HTTP_PROXY` / `HTTPS_PROXY`（小文字も含む）が存在する場合、Node 標準の `http.setGlobalProxyFromEnv()` を引数なしで呼び、既存の `NO_PROXY` を含む設定に従います。プロキシ URL や環境変数を変更せず、値を表示・保存しません。標準 API が使えない・初期化できない場合は直接接続へ切り替えず、リクエスト前に停止します。完了時にはこのプロセス内のクライアント設定を元に戻します。オフラインテストの注入済み通信関数では設定を変更しません。

この環境の Node v24.19.0 は標準 API に対応しています。5件の試行時にはプロキシ変数が存在しましたが、`NODE_USE_ENV_PROXY` / `--use-env-proxy` は有効でなく、取得コードは未設定の標準 fetch を使っていました。経路の不整合は有力な仮説ですが、以前の原因コードがないため全5件の原因と断定していません。変更後の自治体への再試行は行っていません。保存済みホスト停止を維持しています。

根拠: [Node.js 24 HTTP API](https://nodejs.org/docs/latest-v24.x/api/http.html#httpsetglobalproxyfromenvproxyenv)。通信例外では名前と原因コードだけを記録し、元のメッセージ・スタック・プロキシ情報を出力しません。

## 保存ファイル

- `objects/<sha256>.bin`: 取得した原典そのもの。
- `manifest.json`: 原典 URL、掲載ページ、自治体、年度、金額種別、取得/試行日時、SHA256、サイズ、内容種別、HTTP 状態と失敗理由。
- `index.html`: 原典リンクと取得状況。未取得資料も掲載します。構造化は「未実施」と明示し、全国収集完了とは表示しません。

原典を HTML に埋め込んだり自動実行したりしません。保存バイト列を開く場合は manifest の `file` を参照してください。年度・金額・件数の推測補完や数値抽出はしません。閲覧一覧に掲載された自治体数と、本文取得済み自治体数・資料数を区別します。

プロセス停止時にも確定済み manifest は残ります。試行開始を先に保存するため、応答受信前後に中断した資料は失敗状態のまま自動再取得されません。`collection.lock` が残った場合は実行プロセスがないことを確認してから手動で除去してください。失敗・隔離の再審査なしに manifest や隔離状態を消して再取得しないでください。キャッシュ破損・メタデータ変更は黙って再取得せずエラーにします。

既存 PR #1 のブランチ、既存公開データ、デプロイ設定には変更を加えません。出力先には新規専用ディレクトリを指定してください。
