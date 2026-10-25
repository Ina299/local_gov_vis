# 保存本文による既存評価票の補強

対象は第6回の資料台帳で部分抽出417資料・保留161資料とした計578資料。
新しい事業レコードを増やさず、既存票の目的・活動・成果・評価年度・対象年度の空欄と、
未収録の費用・指標・評価・引用根拠を個別に照合する。資料の再確認済みと全項目の抽出完了は異なる。

`data/evaluations/enrichment-provenance.json` は補強前の索引と入力ハッシュを保存し、
元のcore/supplementalデータを変更せず、補強した自治体ファイルのみ内容ハッシュ付きで配信する。
既存値の置換、既存配列の削除、ID・件数・並びの変更は拒否する。同じ費用種別と年度の異値は統合しない。
各引用について、保存本文・原典・自治体のハッシュ連鎖、UTF-16文字位置、原文完全一致を確認する。
同じPDFであるだけでは同一事業とせず、名称または既存票の原文と独立した個票境界を照合する。

原典で確定する数値だけを追加し、直接費・人件費・総費用、予算・決算を区別する。
概算人件費は原文の名称を引用根拠に保持する。評価年度と対象年度は別フィールド。
相対年度の推定、分断した単位や指標名の推定復元、将来予定を実績へ転用する処理は行わない。
長門の「事業の成果・課題」など原典の複合欄は原文の意味のまま保持し、全文章を実績・因果効果とは解釈しない。

## 2026-10-25 の再開と統合

旧作業基点 `9a033a8b` からの未公開成果は保存コミット `ec06954b` に保全した。
master `6b7a8414` の500自治体・92,038年度別レコードと照合し、補強対象5,003票すべての
補強前レコードSHA256が一致した。既存の堺市・品川区向け補強batchも再現したうえで、
全体を保持した追加のフィールド補強層として適用する。レコード数は増減しない。

578資料の確認結果は補強311・変更不要90・保留177。補強51自治体・5,003既存票、
内容11,061項目（目的3,050、活動2,925、成果1,279、評価年度231、対象年度293、
費用3,255、指標18、評点10）。引用根拠13,705件の追加は内容項目数に含めない。
飯塚の費用44・指標8候補は、評価表題と本年度実績の会計年度対応が明示されず不採用。
三次の追加証拠5候補は切詰められた元個票から同一事業名を確認できず不採用。

この補強層がある状態で先行supplemental層を更新する処理は索引不一致で停止する。
次の追記時は補強前基点と候補のレコードSHA256を再照合し、補強を捨てずに統合する。

## 確認と再現

集約台帳は `data/evaluations/enrichment-document-review-batch1.json`、資料別台帳と対象割当は
`data/evaluations/enrichment-review-batch1/` に保存する。各資料に採用patch、完全一致引用、残範囲を記録する。
内容の前後比較は `data/evaluations/enrichment-statistical-audit-batch1.json`。
数値のある事業数、フィールド数、原文引用数を区別し、証拠引用の追加を内容フィールドの補完数へ足さない。

```sh
# 保存本文から5分割の補強入力・資料別台帳を再生成し、採用結果と完全比較
# 出力先は未作成のディレクトリを指定する（publicへは書き込まない）
node --import tsx apps/crawler/scripts/enrichment/reproduce.ts /tmp/evaluation-enrichment-reproduced
# 反映済みの入力と表示結果をオフライン再検証
node --import tsx apps/crawler/src/import-enriched-evaluations.ts --verify
node --import tsx apps/crawler/src/audit-enriched-evaluations.ts . /tmp/enrichment-audit.json
# INPUTにはenrichment-provenance.json内inputs[0].pathを指定する
node --import tsx apps/crawler/src/audit-enrichment-reviews.ts . \
  data/evaluations/enrichment-review-batch1 "$INPUT" /tmp/enrichment-review.json
```

復元時はmanifestと全input、元の索引が参照する不変ファイル、新しい合成ファイルを一緒に保持する。
入力追加コマンドは `import-enriched-evaluations.ts --input <JSON> --generated-at <ISO日時>`。
同一inputの再実行はバイト列を変更しない。公開ディレクトリを入力先に指定できない。
新たな補強は共通基点レコードのSHA256を使用し、先行patch適用後のハッシュへ置き換えない。

## 今回の通信確認

保存本文だけで実施し、今回の自治体への新規取得は0自治体・0資料。
10月18日の設定・ログ確認は当時の結果で、10月25日の接続可否の検証とは別である。
以前の松原市へのproxy CONNECT 403は過去の試行結果であり、現在の全接続先の可否を示さない。
今回確認できた設定だけでは、既存隔離299ホストと照合した新たな取得対象を確定できなかった。
隔離・停止対象、未承認の警告を維持し、接続設定の変更や回避は行っていない。

ブラウザー回帰確認は `apps/crawler/scripts/enrichment/browser-check.cjs`。サブパス付き静的ビルドを
loopbackで配信し、`BASE_URL`、`BROWSER_RESULT`、必要なら `PLAYWRIGHT_MODULE` と
`CHROMIUM_PATH` を指定する。原典リンクは検査だけ行い、外部通信を遮断する。
補強51自治体の引用・新規文章欄・年度不明フィルタと財政・道路・選挙画面を確認する。
