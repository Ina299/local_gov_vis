# 小諸市・令和8年度一般会計当初予算

公式資料: https://www.city.komoro.lg.jp/soshikikarasagasu/somubu/zaiseika/3/2/3/17447.html

既存の令和7年度事業評価218件に、令和8年度一般会計当初予算の249件を追加する。評価年度は設定せず、`initialBudget` に年度・会計・款・項を、`amounts` に予算額（円）を保存する。所管課を款から推測しない。予備費を含み、特別会計は対象外。

## 再生成

保存済みの公式PDF座標テキストからネットワークなしで再生成・統合:

```powershell
npm run -w @local-gov/crawler import:komoro-budget
npm run -w @local-gov/crawler build:evaluation-coverage
npm run -w @local-gov/crawler verify:national-evaluations
```

PDFを再取得して抽出する場合（リポジトリルートから）:

```powershell
Invoke-WebRequest 'https://www.city.komoro.lg.jp/material/files/group/4/R8ippankaikei.pdf' -OutFile apps/crawler/output/komoro-budget/R8ippankaikei.pdf
node --import tsx apps/crawler/src/import-komoro-budget.ts --pdf apps/crawler/output/komoro-budget/R8ippankaikei.pdf
```

原本SHA-256を固定し、差し替え時は処理を停止する。PDF.jsの文字座標を使い、説明欄の事業名と金額を同じ行（折り返し時は直後の行）で結びつける。PDF 92ページの「男女共同参画推進事業」には◎がないため、その正式名称と列位置を確認する。181ページの予備費は目の本年度額から取得する。9ページの総括の14款別予算額と個別合計をそれぞれ照合し、249件・237億円の一致も必須とする。金額を推測して補完しない。

`data/evaluations/komoro-budget-2026.json` は原本URL・SHA-256・取得日時・PDFページ番号・文字座標を持つ再現用スナップショット。既存の追記型統合処理で元の評価データを保持し、公開インデックスとハッシュ付きファイルを更新する。

着想・比較先: https://github.com/thunder-19900512/komoro-budget 。同リポジトリのデータの転載ではなく、市の公式PDFから独立して再抽出している。
