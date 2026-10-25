import json,pathlib,re,collections,sys
base=pathlib.Path(sys.argv[1]);root=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else pathlib.Path.cwd();pub=root/'apps/web/public';a=json.load(open(base/'assignment-4.json'));rows=json.load(open(base/'review-4.json'));patches=json.load(open(base/'patches-4.json'))['patches'];manifest=root/'data/evaluations/enrichment-provenance.json';index=json.load(open(manifest))['baseIndex'] if manifest.exists() else json.load(open(pub/'evaluations-index.json'));datasets={r['municipalityCode']:json.load(open(pub/r['datasetPath']))['projects'] for r in index['municipalities'] if r.get('datasetPath')}
notes={
'12210':'目的と主な活動内容の二列が同一行で混在し、縦書きPLAN・DO・CHECKの断片も含む。既存成果は既に格納済みで上書き禁止。事業費の年度表は計画/予算/決算の空欄を含み、数値位置から年度種別を補わない。',
'46218':'事業一覧の方向性は既存評点に反映済み。政策・施策・基本事業・事務事業の多段階名称が同じ行へ折返され、政策の目的を個別事業の目的へ転用しない。個別活動・成果本文は当該一覧にない。',
'31202':'目的（実施理由）とR6実施内容の見出しが折返し文章の途中にある。見出し以降だけを抽出すると文章冒頭又は末尾が欠落することを確認し、目的補強候補を撤回。一覧版は個票版と再掲関係があり同定証拠未追加。',
'35344':'施策評価の分析・検証本文と末尾の個別事業名/評点/方向性行を分離して確認。個別行には目的・活動・成果本文や費用がなく、上位施策の記述を123事業へ転記しない。',
'42411':'個別事業体系表のR2～R6決算・方向性列は既存の単行確定範囲に反映済み。施策の目標/指標と個別行の名称を同一評価単位としないため文章補強はしない。',
'40217':'独立答申票は改善要望事項等と検討方針が中心。委員の要望や今後の検討を達成済み成果へ移さない。目的の言及も外部提言の名称変更説明に含まれ、行政側の目的欄として補強しない。',
'19366':'事業概要と成果の独立欄は既存activities/outcomesに格納済み。残りは課題と上位教育方針であり目的欄ではない。内訳の学校別購入費と総事業費を混同せず、同じ文章・費用の重複追加をしない。',
'45201':'新規事業評価表で理想/課題/現状/原因の二列とロジックモデル四列が同一行に交錯する。目指す活動実績・成果は将来目標で実績ではない。括弧付きR8総事業費も採択後の予算確定額とは断定しない。No.93は末尾切断。',
'07207':'施策節内の主な事業欄に事業名と金額があるが、文章・指標・今後の方向性は上位施策と共有される。既存81事業の活動/成果として施策本文を複製しない。保存末尾120000字以降は未取得。',
'10209':'事務事業評価結果総括表。事業内容・成果・課題の複数列が同一抽出行で混在するため、495既存行の名称と評点は維持し、混線した文章を目的/活動/成果に分類しない。末尾切断。',
'02446':'事業内容ラベルが折返し文章の途中にあり、例えばALT等の文の途中が「Ｔの各小中学校への派遣」で始まる。単行活動抽出案は撤回。業務群の活動指標を成果指標へ分類し直さず保持。',
'11381':'内容と目的・現状と結果は既存purpose/outcomesに格納済み。平成18年度交流回数は文章25回と表24回に不整合があり、同一指標値を推測して追加しない。費用は既存範囲を維持。',
'03205':'一枚票の左列目的/概要と右列成果分析/評価が同じ行に混在する。市民向け目的文の後半に成果分析が接続し、活動の内訳額も右列評価と交錯するため列座標なしに文章や内訳費用を切出さない。',
'01333':'分類番号・施策/事業名・担当課・実績・課題が多段に折返す一覧。同一URL/hashに結び付く既存票なし。事業名を再同定できない段階で施策実績を付加しない。',
'05346':'教育委員会事業点検の表。名称の縦折返しと実績/評価列の混線があり、既存票に結び付く事業同定証拠なし。上位教育活動の数値を別個事業に割当てない。',
'12235':'主要個別事業計画兼簡易評価総括表。事業名・目的・実績・評価が横並びで交錯し、R8～R10将来計画額をactual/budgetと分類する根拠なし。既存票に結び付く同一原典証拠なし。',
'12236':'施策評価主体。関連取組と施策指標が同じ行へ混在し、既存事務事業への同定なし。施策指標を事業成果として転用しない。保存末尾切断。',
'10201':'総合計画の施策/主要事業群単位の評価。個別取組と総合方針が混在し、既存事務事業との同一性を証明できない。',
'40227':'自己評価一覧表で事業名・事業概要・複数評価列・部署が縦横交錯する。同一原典を持つ既存票がなく、名称/評点/本文が一対一になる座標根拠がない。',
'46224':'二次評価一覧33事業の事業名・目的・決算・効果検証・委員意見が同じ行に混在。既存票との同定証拠なし。委員意見や施策縦書き断片を成果欄へ転用しない。',
'44202':'行政改革計画の改革項目と重要課題をまとめた表。担当課を跨ぐ項目の実績・目標・今後の方向性であり、既存事務事業との同定を示す原典証拠がない。改革項目を事業目的/成果に置換しない。',
'34211':'全体報告と既存の分割原典73事業は再掲候補。分割元と全体版の原典hash/URLが異なり、今回の元原典に結び付く同定proofなし。H26～R2の表頭だけから評価対象年を設定しない。',
'46201':'全体報告のR4/R7当初予算とR5/R6方向性を併記する一覧。既存959票とは別原典で、同年度・同一事業の同定証拠を確定できない。120000字で切断。',
}
for r,item in zip(rows,a):
 assert r['documentId']==item['documentId'];d=json.load(open(pub/'evaluation-evidence/documents'/(r['documentId']+'.json')));text=d['text'];ps=datasets.get(r['code'],[]);linked=[p for p in ps if any(e.get('sourceUrl')==d['sourceUrl'] and e.get('sha256')==d['sourceSha256'] for e in p['evidence'])]
 # Read full local text, and retain a document-specific audit of headings and provenance.
 assert len(text)>0
 r['evidenceQuotes']=[q for q in r['evidenceQuotes'] if len(q)>=8 and q in text]
 if r['status']!='enriched':
  r['reason']=notes.get(r['code'],r['reason'])+' 照合した保存本文は'+str(len(text))+'文字。'
  r['remainingScope']=r['reason']
  r['projectIds']=[p['id'] for p in linked]
  if r['code'] in ['31202','02446','12210','45201','03205','10209']:
   r['status']='held'
  heads=[m for m in re.finditer(r'^.*(?:事業の目標|主な活動内容|事業内容|事業概要|目的|改善要望|主な事業|今後の課題|主な 事業|事業費|予算|決算|実績).{0,65}$',text,re.M)]
  if heads:
   for m in heads[:2]:
    q=text[max(0,m.start()-70):min(len(text),m.end()+120)]
    if q not in r['evidenceQuotes']:r['evidenceQuotes'].append(q)
  r['evidenceQuotes']=r['evidenceQuotes'][:5]
 else:
  if r['code']=='38205':r['remainingScope']+=' 総合評価中の今後・必要性・課題等に移る前の、過去実施を示す完結文のみ成果へ採用。総合評価全文を成果とはしない。'
  if r['code'] in ['13107','13203','01213']:r['remainingScope']+=' 目的/活動の途中に入る欄ラベルは原文のまま保持。隣接列本文を含む成果欄の分離は未実施。'
  r['remainingScope']+=' この補強は文章欄のみ。未補強の費用内訳・数値指標・年度の追加を完了したとは扱わない。'
 if not r['evidenceQuotes']:r['evidenceQuotes']=[text[:min(len(text),150)]]
 assert all(q in text for q in r['evidenceQuotes'])
json.dump(rows,open(base/'review-4.json','w'),ensure_ascii=False,indent=2)
print(collections.Counter(x['status'] for x in rows))
