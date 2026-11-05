import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[4];docs=root/'apps/web/public/evaluation-evidence/documents';configs=[];stage=Path(__file__).parent
inventory=json.loads((root/'data/evaluations/descending-offline/40/source-ledger.json').read_text())
def verified_text(id,code):
 meta=json.loads((docs.parent/'municipalities'/(code+'.json')).read_text())
 src=next(s for s in meta['sources'] if s['id']==id); info=src['text']; parts=[info]+info.get('continuations',[]); text=''; offset=0
 for n,part in enumerate(parts,1):
  assert part['assetPath']=='documents/'+id+('' if n==1 else '-'+str(n))+'.json'
  raw=(docs.parent/part['assetPath']).read_bytes(); assert len(raw)==part['assetBytes'] and hashlib.sha256(raw).hexdigest()==part['assetSha256']
  d=json.loads(raw); assert d['sourceId']==id and d['sourceUrl']==src['url'] and d['sourceSha256']==src['acquisition']['sourceSha256']
  assert len(d['text'])==part['exportedCharacters'] and hashlib.sha256(d['text'].encode()).hexdigest()==part['textSha256']
  if n>1: assert part['part']==n and part['startCharacter']==offset and d['startCharacter']==offset
  text+=d['text'];offset+=len(d['text'])
 assert offset==info['characters'] and hashlib.sha256(text.encode()).hexdigest()==info.get('fullTextSha256',info['textSha256'])
 return text
def cached_text(id):
 q=next(x for x in inventory if x['sourceId']==id)
 return verified_text(id,q['municipalityCode'])
def source(id,code,fy,ey,proof):
 q=next(x for x in inventory if x['sourceId']==id);assert q['municipalityCode']==code
 t=verified_text(id,code);assert proof in t
 c=dict(sourceId=id,municipalityCode=code,year=fy,evaluationYear=ey,proof=proof,fullTextSha256=hashlib.sha256(t.encode()).hexdigest(),rows=[],holds=[]);configs.append(c);return c,t
def row(c,t,name,raw=None,start=None,note='Explicit cached business title only; no costs or policy scores inferred.'):
 raw=raw or name;a=t.index(raw) if start is None else start;assert t[a:a+len(raw)]==raw
 c['rows'].append(dict(name=name,raw=raw,start=len(t[:a].encode('utf-16-le'))//2,note=note))
def hold(c,t,raw,reason,status='identity_or_period_hold'):
 a=t.index(raw);c['holds'].append(dict(raw=raw,start=len(t[:a].encode('utf-16-le'))//2,reason=reason,status=status))
for reviewed,ey in zip(json.loads((stage/'fukuoka-chikujo-title-review.json').read_text()),[2025,2024]):
 c,t=source(reviewed['sourceId'],'40647',None,ey,'令和７年度事務事業評価' if ey==2025 else '令和６年度事務事業評価')
 for h in reviewed['rows']:
  n=h['name']
  if '基金事業' in n or '交付金' in n or n in ['その他事業費','その他事業']:
   hold(c,t,h['raw'],'Funding-specific budget title may overlap the same facility/programme management title; independent identity requires full individual sheet. No new project for funding category or unspecified other business.');continue
  row(c,t,n,h['raw'],h['start'],note='総括表の予算事業名を原文照合。評価年度のみ。R6/R7当初NETと翌年度NET上限は決算額にせず、一次・調整後・前年度評価も列位置未確定のため未抽出。')
 hold(c,t,'総括表','Budget, next-year NET ceiling and multiple score columns must retain their separate meanings. Original table-cell alignment needed for numeric fields; no values copied.')
c,t=source('31b9cfedc496e5641459d697','40646',None,None,'上毛町総合戦略');hold(c,t,'具体的な事業','Three overlapping 大池公園 sheets; H29.3 KPI observation and H31/H33/H34 targets do not establish unique annual execution/evaluation period. Need dated annual attribution and independent project identity; no triple counting.')
# Subsequent sources remain active, not terminal layout holds.
for id,code,fy,ey,proof in [('de30743448ebc5c9b462a236','40625',2021,2022,'（令和３年度対象）'),('a8f15392a543561c09f89777','40625',2020,2021,'（令和２年度対象）')]:
 c,t=source(id,code,fy,ey,proof)
 hold(c,t,'主要事業','Review named individual activities separately from policy goals and external evaluations; prior-year ratings in brackets must not be inherited.',status='layout_review')
c,t=source('6c141cf71bba860ccb7d0af4','40605',2020,None,'令和２年度')
for name in ['川崎町がんばろう生活給付金事業','川崎町持続化緊急支援金','感染予防対策事業','必需物品供給事業','GIGAスクール端末導入事業','GIGAスクール電子黒板整備事業','公共的空間安全・安心確保事業（中学校）','公共的空間安全・安心確保事業（小中学校）','川崎町ReBorn！商品券事業','事業者家賃等軽減支援事業','新生児応援特別給付金','感染予防対策事業②（選挙）','必需物品供給事業②','公共的空間安全・安心確保事業（避難所）','イルミネーション事業','川崎町内飲食店MAP制作事業','プレミアム付商品券助成事業','庁舎WEB会議環境整備事業','スマートウェルネスシティ推進事業','学校保健特別対策事業費補助金','障がい者総合支援事業費補助金']:
 row(c,t,name,note='R2年度活用事業、記載の実施期間R2年4月〜R3年3月内を照合。学校保健補助金2費目は同名1件に集約。給付・補助金と事務費を別事業にしない。決算・充当・一般財源は未抽出。')
hold(c,t,'学校保健特別対策事業費補助金','Two funding portions of school-health support share the named programme; one identity only. Amount/recipient/date columns not copied without exact cell binding.')
c,t=source('c53d5bfce614b99ea3b53a40','40602',2023,2024,'（令和５年度事業対象）')
for name in ['小中学校校舎建設事業','学校図書室サポート業務委託事業','ふれあい学級推進事業','生涯学習講座開設事業','子どもの読書活動推進事業','児童館活動推進事業','人権・同和問題啓発事業','地域学校協働活動事業']:
 a=t.index(name,t.index('（１）外部評価委員会委員からの事業別評価一覧')+100)
 row(c,t,name,start=a,note='8事業の個別評価一覧と本文名称を照合。R5対象/R6評価。選択肢A〜Fの並記から評定を推測しない。将来の開校年度は対象年度にしない。')
hold(c,t,'８事業','All eight names reviewed; unmarked A–F option lists are not selected ratings. Policy goals and future opening dates not transferred.')
c,t=source('bcac8a0883e08963d123547d','40421',2023,None,'令和５年度事業')
ms=list(re.finditer(r'事業名：([^\n]+)\n担当課係',t));assert len(ms)==44
for m in ms:
 a=m.start(1);row(c,t,m[1],start=a,note='R5年度事業の44個別シート。事業名・担当課係の明示境界を照合。政策章や構成活動を別事業にしない。数値と総合評価本文は名称に結合せず保持。')
 c['rows'][-1].update(context=t[m.start():m.start()+250],contextStart=len(t[:m.start()].encode('utf-16-le'))//2)
hold(c,t,'総合評価','Narrative evaluations and numerical activity counts require field-specific evidence review; no guessed rating scale or cost.')
for id in ['fb3959652a90184d159107b7','f12024c7351dad6120c07151','1d0b5ddf756e2e5090206e18']:
 t=cached_text(id);c,t=source(id,'40382',None,None,t[:50]);hold(c,t,t[:150],'Hash-verified text has corrupted glyph decoding: years and names lose characters or become mojibake. Need locally available original PDF/font mapping or a trustworthy corrected text; do not reconstruct missing names/years from neighbouring annual reports. This is text evidence damage, not a current network denial.')
c,t=source('409838f6609730708d231cd9','40382',2023,None,'○令和5年度新型コロナウイルス感染症対応地方創生臨時交付金')
for name,raw in [('価格高騰緊急支援給付事業【低所得者世帯給付金】','価格高騰緊急支援給付事業\n【低所得者世帯給付金】'),('みずまき暮らし・生活支援臨時特別給付金事業','みずまき暮らし・生活支援臨時特別給付金\n事業')]:
 row(c,t,name,raw,note='R5実施期間内の給付2事業。事務費・子育て世帯分・通常/重点財源は本文に同事業と明記されるため追加しない。金額や対象数は未抽出。');c['rows'][-1].update(context=t,contextStart=0)
hold(c,t,'プレミアム付商品券発行事業（第3弾）','R5.3.8–R6.3.19 spans FY2022/2023. No unique annual execution field without annual split; no inferred period from funding label.')
c,t=source('31e2a5d17937de8ccdf5de7f','40382',None,None,'○令和5年度物価高騰対応重点支援地方創生臨時交付金');hold(c,t,t[:100],'All three benefit periods span FY2023/2024; footnote explicitly includes FY2024 expenditure in rows2/3. Need annual split/unique period, not grant-year inference. Comparison with next-year book needed to avoid repeated carryover identity.')
c,t=source('66c8dede38aba7e4b55081c4','40382',2024,None,'○令和6年度物価高騰対応重点支援地方創生臨時交付金')
for name,raw in [('新たな住民税非課税世帯給付金給付事業',None),('新たな住民税均等割のみ課税世帯給付金給付事業','新たな住民税均等割のみ課税世帯給付金\n給付事業'),('定額減税補足給付事業',None),('プレミアム付商品券発行事業（令和6年度第1弾）','プレミアム付商品券発行事業\n（令和6年度第1弾）'),('令和6年度水巻町子育て世帯応援事業（水巻こそだてコスモスぺい）','令和6年度水巻町子育て世帯応援事業\n（水巻こそだてコスモスぺい）'),('水巻町私立保育所等給食支援費補助事業',None),('水巻町第二保育所等給食支援費補助事業',None),('水巻町私立保育所等物価高騰対策費補助事業','水巻町私立保育所等物価高騰対策費補助事\n業')]:
 row(c,t,name,raw,note='R6年度内実施の3/4/5/8/9/10/11/13番行を照合。R5から/R7への繰越給付行は別途保留。決算額・充当額や給付件数は未入力。');c['rows'][-1].update(context=t,contextStart=0)
hold(c,t,'住民税均等割のみ課税世帯給付金給付事業','Rows1/2 span FY2023/2024 and repeat prior-book carryovers; rows6/7/12 span FY2024/2025. Preserve without adding full-period amounts or assigning grant year as sole execution year.')
for c in configs:
 if c['municipalityCode']!='40625':continue
 t=cached_text(c['sourceId'])
 for name in ['子どもの学習支援事業','家庭教育支援総合推進事業','読書週間関連事業','ブックスタート事業','みやこ町人権教育研究会事業']+(['読書ボランティア養成事業'] if c['year']==2021 else []):
  a=t.index(name);row(c,t,name,start=a,note='対象年度の個別活動名と前後の実績・中止記述を照合。県が実施する学区と町実施学区を混同せず、政策全体の評価や翌年度観測人数は転記しない。ブックスタートの年齢別フォロー活動は独立事業として重複追加しない。');c['rows'][-1].update(context=t[max(0,a-100):a+600],contextStart=len(t[:max(0,a-100)].encode('utf-16-le'))//2)
c,t=source('4e5cf96181db041ad25c17db','40349',2020,None,'■粕屋町 令和２年度の取組');hold(c,t,'162事務事業','Policy/classification aggregate of 162 businesses; no individual names. Counts by category are not 162 project records. Need the separately listed individual sheets, not missing permission.')
c,t=source('cb3e64692e044646ba481a7f','40345',None,2025,'令和７年５月８日');hold(c,t,'事後評価報告書（中間評価）','Evaluation date and Wi-Fi outcomes are explicit, but body identifies only broad subsidy framework, not precise local project title. Inventory title 高度無線環境整備推進事業 needs authoritative saved link/title attribution before creating a named business. No original construction FY inferred from completion date or KPI target year.')
for id,fy,ey in [('9e0431fda1b158543589fde3',2025,2026),('b74e0acef9b3f4bd4d6a1407',2024,2025),('714e7cf606b650566c4d2f7c',2023,2024),('dbb0f1de9685993111b7e400',2022,2023),('9eb9a3ce6721f90b89eb1d80',2021,2022),('a49f63c3f770cce9adb86b39',2020,2021),('90e5e6a32d805916fe308b46',2019,2020),('35d34adc4d21d33d13db414c',2018,2019),('330c6a518ac4f7ba1c22db14',2017,2018),('1b25020b05b0b870c0c20bc9',2016,2017)]:
 t=cached_text(id);c,t=source(id,'40342',fy,ey,t.splitlines()[0])
 for name in ['ファミリー・サポート・センター事業','篠栗北地区産業団地開発事業','荒廃森林整備事業']:
  if name not in t:continue
  a=t.index(name);row(c,t,name,start=a,note='総合戦略本文内の具体的な個別事業名のみ。総合戦略全体・政策目標・KPIを事業にせず、実績値も継承しない。共同事業は当町の記載範囲のみ。');c['rows'][-1].update(context=t[max(0,a-100):a+600],contextStart=len(t[:max(0,a-100)].encode('utf-16-le'))//2)
 hold(c,t,t[:100],'Policy/KPI chapters contain further named local activities; complete remaining boundary review before concluding this source. Target-year population/employment and prefectural programmes are not individual local projects.',status='layout_review')
c,t=source('a20adb68330240f6446099e8','40503',2024,None,'令和6年度');hold(c,t,'起債事業名','All seven 事業名 occurrences belong to enterprise debt schedules: borrowing, repayments, balances and due dates are not new annual business records or expenditure. Account statements and contracts do not establish distinct evaluated business identities; require individual programme mapping before adding records.')
c,t=source('8b09f2908dc0a559aa6a771f','40382',2025,None,'○令和7年度物価高騰対応重点支援地方創生臨時交付金')
for name,raw in [('定額減税補足給付金（不足額給付）',None),('水巻町保育所等給食支援費補助事業',None),('水巻町こども食堂物価高騰支援費補助事業',None),('水巻町社会福祉施設等物価高騰対策支援金給付事業','水巻町社会福祉施設等物価高騰対策支援金\n給付事業（障がい分）'),('プレミアム付商品券発行事業（令和7年度）',None)]:
 row(c,t,name,raw,note='R7年度内実施の3/5/6/7・8/9番行。障がい分と介護分は町予算の関係による分割と本文に明記される同一支援事業のため1件。R6繰越給付とR8までの商品券事業は除外。金額や途中集計は未入力。');c['rows'][-1].update(context=t,contextStart=0)
hold(c,t,'令和6年度水巻町物価高騰対応重点支援地方','Rows1/2 are prior-year carryover portions, not separate new full-period businesses. Row4 runs R7.12.19–R9.3.31; no single-year execution inference. Rows7/8 explicitly budget splits of one social-welfare facility support programme.')
c,t=source('a12fe967993b964641d45b72','40344',2024,2025,'令和６年度 須恵町教育委員会の権限に属する')
for name in ['一時預かり事業','子育て支援センター機能事業']:
 a=t.rfind(name);row(c,t,name,start=a,note='R6点検報告の実施記述にある個別保育・子育てサービス名。政策目標・参加者増減や講演会等の構成活動は別事業にせず、政策評価も継承しない。');c['rows'][-1].update(context=t[max(0,a-100):a+300],contextStart=len(t[:max(0,a-100)].encode('utf-16-le'))//2)
hold(c,t,'第三期須恵町教育振興基本計画','Remaining headings are education policy goals and indicators, or component events/model club activities without independently identified business boundaries. Need explicit local programme identity to structure those; do not create records for each policy chapter or KPI.')
c,t=source('3fbea5d9c05c3f8ed29fcc51','40601',2024,None,'令和５年度')
for name,raw in [('福岡県香春町物価高騰対応重点支援給付金（R6非課税化等）【物価高騰対策給付金】','福岡県香春町物価高騰対 低所得の方々の生活を維持する。\n応重点支援給付金（R6非課 （R6-2の事業においても実施）\n税化等）【物価高騰対策給\n付金】'),('福岡県香春町物価高騰対応重点支援給付金（調整給付）【物価高騰対策給付金】','福岡県香春町物価高騰対\n応重点支援給付金（調整給\n付）【物価高騰対策給付金】'),('香春町プレミアム商品券発行事業費負担金','香春町プレミアム商品券発 購入時に20％のプレミアム分を上乗せした町独自の商品券を発行し、\n行事業費負担金（重点支援 コロナ禍におけるエネルギー食料品価格等の物価高騰の影響を受け\n分）')]:
 row(c,t,name,raw,note='R5交付金表だが4/5/10番行の実施開始終了はR6年4月〜R7年2月でFY2024。R6-2重複財源は別事業にしない。表の金額や率は未入力。');c['rows'][-1].update(context=t,contextStart=0)
hold(c,t,'R6.1.17','Rows1–3 span FY2023/2024. No unique annual execution identity without annual breakdown; cannot inherit R5 funding label.')
c,t=source('fc1795d835b78725aa2ded5d','40610',None,None,'Ⅱ－ 第２期 福智町総合戦略 の成果')
for name,raw,fy,yp in [('AIオンデマンドバス「ふく～るバス」の導入','AIオンデマンドバス\n「ふく～るバス」の導入',2022,'（令和4年度導入、令和5年度本格運行開始）'),('複合型スポーツ施設「フクチ・ファインド・フィールド」の開設',None,2023,'（令和5年度）'),('グローバル人材育成事業','グローバル人材＊ 育成事業',2023,'（令和5年度から）')]:
 a=t.index(raw or name);row(c,t,name,raw,start=a,note='明示された個別導入・開設・事業開始年度のみ。継続各年への展開はせず、政策目標や4か年累計KPI・寄附額は転記しない。');c['rows'][-1].update(year=fy,yearProof=yp,context=t[max(0,a-50):a+300],contextStart=len(t[:max(0,a-50)].encode('utf-16-le'))//2)
hold(c,t,'令和2年度～ 4か年実績','Cumulative strategy outcomes and general services do not establish annual business sheets. Bus appears twice but one introduction identity only. Component publications, agreements and general KPI headings not separate businesses.')
c,t=source('3e3004b63a443fe242ce6610','40602',2023,None,'令和5年度 新型コロナウイルス感染症対応地方創生臨時交付金 実施状況及び効果検証')
for name,raw in [('添田町学校給食費物価高騰対策等補助金','添田町学校給食費物価高 従来の金額設定では提供ができない為、給食費の値上げを\n行う予定。町内小中学校に対して給食費の値上げ分の補助\n騰対策等補助金'),('プレミアム商品券事業',None),('社会福祉施設等物価高騰対策支援金','社会福祉施設等物価高騰\n対策支援金'),('配食サービス事業支援金',None),('地域振興施設等支援金・福祉分野','地域振興施設等支援金・\n福祉分野'),('地域振興施設等支援金・観光分野','地域振興施設等支援金・\n観光分野'),('保育施設物価高騰対策',None),('子育て世帯物価高騰対策',None),('高齢者物価高騰対策支援',None),('道の駅歓遊舎ひこさん節電対策支援','道の駅歓遊舎ひこさん節\n電対策支援'),('防犯灯節電対策支援',None),('保育施設給食費高騰対策支援','保育施設給食費高騰対策 コロナ禍における電力・ガス等の物価高騰の影響を受けてい\nる保育施設の給食費への補助を行う事により、栄養バランス\n支援')]:
 row(c,t,name,raw,note='R5年度実施状況報告の個別事業名。対象年度は報告範囲であり全期間の実施開始年度ではない。商品券No7/10、配食No12/20は明示重複のため各1件。費用・交付金・行政費内訳は抽出しない。');c['rows'][-1].update(context=t,contextStart=0)
hold(c,t,'【事務費】','Benefit rows1/2/8 split grant framework, administrative cost and supplementary households; standalone title identity unresolved. Do not add administration or the two-household tranche as new projects. Voucher carryover No7/10 and meal No12/20 each one annual reviewed programme.')
c,t=source('aa09a49c57ebd963dc05d7cf','40447',2021,None,'令和３年度事業')
for name,raw in [('筑前町育ち盛り子どもたちの「食」の応援事業','筑前町育ち盛り子どもたちの『食』の応 大きくなった０歳～18歳の子どもがいる世帯に対して、 5,053人に対し、１人あたり地元産のお米10㎏等をド\n1\n援事業'),('保育所・幼稚園等における感染予防対策事業','保育所・幼稚園等における感染予防対 町内保育所・幼稚園等（13施設）に新型コロナウイルス 町内の13施設に対し、それぞれ50万円の支援金を交\n策事業'),('新型コロナウイルス感染症防止協力飲食店等支援金','新型コロナウイルス感染症防止協力飲\n18\nからの支援金を受けている飲食店に対し、町独自での支 支援金：5万円×47店舗\n食店等支援金'),('子育て世帯への臨時特別給付金事業（町単独）','子育て世帯への臨時特別給付金事業\n23\n（町単独）')]:
 row(c,t,name,raw)
for name in ['公共的空間安全・安心確保事業①','学童施設感染予防対策事業','公立保育所における感染予防対策事業','ちくぜん食の仕送り便事業','公共的空間安全・安心確保事業②','特産品活用支援事業','酒類販売事業者支援事業','新型コロナウイルス対策事業者応援事業','教育情報化推進事業①','図書館パワーアップ事業','新型コロナワクチン接種推進事業','休日夜間初期急患診療事業支援金','防災活動支援事業','ごみ減量化対策事業','保育対策総合支援事業費補助金','草刈応援事業','コロナに負けるな！筑前町元気づくり事業','地域の元気を発信する事業','農業者経営支援事業','学校環境整備事業','教育情報化推進事業②']:
 row(c,t,name)
for r in c['rows']:r.update(context=t,contextStart=0,note='R3年度表の25掲載事業。各事業期間はR3.6〜R4.3内。番号24は原文にないため作らない。①②は内容・番号が別の明示名、設備部品や財源内訳を追加しない。費用・評価数値は未抽出。')
assert len(c['rows'])==25
hold(c,t,'交付金充当額（千円）','Business costs and allocated grants are separate columns; no amount inferred from text order. Listed rows1–23,25,26 only; absent24 is not reconstructed.')
# Kurate: the table explicitly defines its annual cost scope as H20, not the newsletter year.
c,t=source('8a3024ba0f35d1bcfc384c50','40402',2008,None,'使った平成 20 年度の総費用')
for name,raw in [('ホームページ事業','ホームページ\n事業'),('リサイクル活動団体支援事業','リサイクル\n活動団体支援\n2\n事業'),('食と農理解促進事業','食と農\n理解促進事業'),('ふれあいフェスタ','ふれあい\nフェスタ'),('総合福祉センター運営事業（福祉棟）','総合福祉セン\nター運営事業\n5\n（福祉棟）'),('図書室管理運営事務','図書室管理\n運営事務'),('情報通信技術講習事業（IT講習）','情報通信技術\n講習事業\n7\n（IT 講習）'),('町民体育祭事業','町民体育祭\n事業'),('中央公民館長谷別館管理運営事業','中央公民館\n長谷別館管理\n9\n運営事業'),('大谷自然公園管理運営事務','大谷自然公園\n管理運営事務'),('産業まつり事業','産業まつり\n事業'),('教材備品整備事務','教材備品整備\n事務'),('保育所・幼稚園学用品費補助金事務','保育所・幼稚\n園学用品費補\n13\n助金事務'),('総合プール管理運営事務','総合プール\n管理運営事務'),('人権問題地区懇談会事業','人権問題\n地区懇談会\n15\n事業'),('敬老の日事業',None),('資料館企画展開催事業','資料館企画展\n開催事業'),('総合福祉センター運営事業（管理・保健棟）','総合福祉セン\nター運営事業\n18\n（管理・保健棟）'),('総合福祉センター運営事業（ふれあい棟）','総合福祉セン\nター運営事業\n19\n（ふれあい棟）'),('町営住宅維持事業','町営住宅維持\n事業'),('町職員研修事務','町職員研修\n事務')]:
 row(c,t,name,raw,note='全21事業の外部評価表を個別照合。対象は説明欄に明示されたH20年度総費用の事業。紙面2010年を実施・評価年度へ推測せず、評価年度は空欄。サンプル広報紙事業・アンケート再掲・後続の町ニュースは除外。総費用は人件費試算を含み直接事業費と区別が必要なため未抽出。')
hold(c,t,'表の見方（サンプル）','Sample 広報紙事業 is not one of the 21 reviewed records. Questionnaire restates 11 of the same projects, not additions. Detached year digits do not safely bind evaluation year; total cost includes estimated personnel cost and is not copied as direct expense.')
for c in configs:
 if c['municipalityCode']!='40625':continue
 t=verified_text(c['sourceId'],'40625')
 for name in ['学力向上ドリル事業','豊津地区学校再編整備事業','通学合宿事業']:
  if name in t:
   a=t.index(name);row(c,t,name,start=a,note='年度報告の個別事業実施・中止記述。建設の将来開校年度を当年度にせず、中止事業を実施成功と記述しない。政策の評価や児童数は転記しない。');c['rows'][-1].update(context=t[max(0,a-60):a+400],contextStart=len(t[:max(0,a-60)].encode('utf-16-le'))//2)
 raw='小中連携教育指\n定校事業'
 if raw in t:
  a=t.index(raw);row(c,t,'小中連携教育指定校事業',raw,start=a,note='旧小中一貫教育指定校事業からの名称変更を本文で確認。同一取組の旧名を追加しない。年度報告の継続事業名のみで成果評点は未抽出。');c['rows'][-1].update(context=t[max(0,a-100):a+400],contextStart=len(t[:max(0,a-100)].encode('utf-16-le'))//2)
c,t=source('7f46d30943112fe91b3d425b','40227',2024,2025,'評価対象：令和6年度事業')
excluded={'文書仕分け、発送業務、庁舎間文書使送便委託業務、文書管理システムの管理事務','情報公開請求処理業務及び政治倫理審査会運営事業','施設管理を委託する指定管理者について審査する委員会の事務事業','閉校となった旧嘉穂地区にある3小学校の管理に関する事業','普通財産管理に関する事業','市バスの運行に使用するバス車両を購入する事業','助事業','習得資金貸付事業','特別児童扶養手当に関する補助事業関連事務','教育認定こどもが利用する幼稚園に対し、その教育に係る費用を給付する事業','幼児教育無償化により移設等利用給付認定こどもに係る費用を給付する事業','子育て世帯生活支援特別給付金支給に関する補助事業関連事務','出産・子育て応援交付金支給に関する補助事業関連事務','身体障害者手帳の再交付申請進達及び交付事務','薬草園と梅林公園の維持管理する事業','市営キャンプ場を管理運営する事業','通学対策事業、就学援助事業'}
ms=list(re.finditer(r'^([^ \n]+(?:課|室|事務局|センター)) ([^ \n]+(?:事業|事務|事務費|管理費)) ',t,re.M));assert len(ms)==135
for m in ms:
 if m[2] in excluded:continue
 row(c,t,m[2],start=m.start(2),note='R6事業/R7年6月自己評価一覧の担当課直後の完全名称を個別照合。事業概要が名称欄の位置に流れた17候補は除外。決算額・必要性・効果・将来方向の列を位置から推測しない。');c['rows'][-1].update(context=t[max(0,m.start()-150):m.end()+250],contextStart=len(t[:max(0,m.start()-150)].encode('utf-16-le'))//2)
hold(c,t,'議会ペーパーレス化事','Wrapped/displaced title columns remain actionable. Seventeen description/fragments excluded from simple line parser; review complete title boundaries explicitly rather than accepting description as project.',status='layout_review')
for id in ['23eb6a734bf44ec00208174c','948a499b4c6a4854b639dad7']:
 t=cached_text(id);c,t=source(id,'40227',None,None,t[:80]);hold(c,t,t[:80],'Administrative evaluation implementation methodology/schedule, not completed individual business sheets. No annual programme records from instructions or aggregate counts.')
reviewed=json.loads((stage/'fukuoka-kama-wrapped-review.json').read_text());c=next(c for c in configs if c['sourceId']==reviewed['sourceId']);t=verified_text(c['sourceId'],'40227');assert hashlib.sha256(t.encode()).hexdigest()==reviewed['fullTextSha256']
for h in reviewed['rows']:
 if '基金：' in h['name']:
  hold(c,t,h['raw'],'Irrigation maintenance fund/district financing title may overlap ordinary maintenance programme; independent identity not established. No extra annual project for funding label.');continue
 # reviewed offsets are UTF-16; Python offsets are reconstructed from the exact quoted range.
 a=t.index(h['raw']);assert len(t[:a].encode('utf-16-le'))//2==h['start']
 row(c,t,h['name'],h['raw'],start=a,note='嘉麻市自己評価一覧の折返し名称を前後3行の保存本文で個別照合。繰越明許・事故繰越を別事業にせず、同名の部署別行は重複照合。全費目・成果・評点は未抽出。')
c=next(c for c in configs if c['sourceId']=='7f46d30943112fe91b3d425b');t=verified_text(c['sourceId'],'40227')
for name in ['選挙啓発費','デジタル戦略事業','男女共同参画推進事業','男女共同参画啓発事業','地域振興事業','集会所管理費（山田）','子ども医療対策費','集会所維持管理費','就労準備支援事業','嘉穂第２学童保育所費','碓井学童保育所','稲築西学童保育所','稲築東学童保育所','下山田学童保育所費','上山田学童保育所','嘉穂学童保育所','自立相談支援費','商工業振興費','農事区活動費','産地形成政策費','担い手育成政策費','有害鳥獣被害対策費','中山間地域保全対策費','農地中間管理促進費','多面的機能維持費','畜産政策費','治山事業費','都市公園費','道路橋りょう維持費','河川維持費','非常備消防費','学校給食事業（山田）','学校給食事業（稲築）','学校給食事業（嘉穂）','学校給食事業（碓井）','地区公民館費（山田）','地区公民館費（稲築）','地区公民館費（碓井）','ふるさと交流館運営費','文化財保護審議会費','文化財調査費','碓井住民センター費','土木施設災害復旧費','啓発・広報事業','嘉穂隣保館維持管理費','人権啓発活動地方事業','調査研究事業','デイサービス事業','老人保護措置事業','老人クラブ助成事業','高齢者福祉事業','敬老事業','社会福祉施設運営事業','災害支援事業','児童相談事業','助産施設入所措置事業','母子等相談事業','養育支援訪問事業','乳幼児保健事業','妊婦保健事業','発達支援連携事業','教育相談事業','こども政策推進事業','プール管理費','グラウンド管理費','体育館管理費','テニスコート管理費','野球場管理費','プロジェクトＫ事業','スポーツ活性化事業']:
 # The title-column occurrence is at a line start or directly after a department name.
 ms=list(re.finditer(r'^(?:[^ \n]+ )?'+re.escape(name)+r' ',t,re.M));assert ms,(name, 'title occurrence missing')
 m=ms[0];a=m.end()-len(name)-1;assert t[a:a+len(name)]==name
 row(c,t,name,start=a,note='嘉麻市の年度別自己評価一覧に明記された単独タイトル。名称が費・施設名で終わる場合も個別行の対象として保存。内部庶務・基金移動・繰越財源から新事業を追加せず、金額・評価は未抽出。');c['rows'][-1].update(context=t[max(0,m.start()-130):m.end()+250],contextStart=len(t[:max(0,m.start()-130)].encode('utf-16-le'))//2)
for id,fy,ey,proof in [('d20bcc74ee66e3d51f4c5252',2024,2025,'令和 6 年度進捗状況報告書'),('3146bdccf4d095ac09c89950',2025,2026,'令和 7 年度進捗状況報告書')]:
 c,t=source(id,'40229',fy,ey,proof)
 names=[('デジタルを活用した魅力発信事業',None),('おむつお届け事業',None),('産前産後サポート事業','産前産後\nサポート事業')] if fy==2024 else [('霊柩自動車運行事業',None),('マイナンバーカードを活用した救急業務の実証事業',None)]
 for name,raw in names:
  a=t.index(raw or name);row(c,t,name,raw,start=a,note='年度の実施内容欄に明示された個別事業名のみ。R6報告の翌年度マイナ救急計画をR6実績にせず、改革方針66事項やKPIは別事業にしない。評点・費用は転記しない。');c['rows'][-1].update(context=t[max(0,a-550):a+350],contextStart=len(t[:max(0,a-550)].encode('utf-16-le'))//2)
 hold(c,t,'行政改革個別プラン進捗状況','Other 66 reform actions track internal management, HR, financial planning and multi-year targets. They are not 66 independently identified business records. Future deployment columns and national/prefectural system references excluded; numerical alignment remains unstructured.')
# Reviewed follow-up mappings remain bound to exact cached text and UTF-16 offsets.
for extra in json.loads((stage/'fukuoka-next-reviewed.json').read_text())+json.loads((stage/'fukuoka-second-reviewed.json').read_text()):
 t=verified_text(extra['sourceId'],extra['municipalityCode']);assert hashlib.sha256(t.encode()).hexdigest()==extra['fullTextSha256'];assert extra['proof'] in t
 encoded=t.encode('utf-16-le')
 for h in extra['rows']+extra['holds']:
  assert encoded[h['start']*2:h['start']*2+len(h['raw'].encode('utf-16-le'))].decode('utf-16-le')==h['raw']
  if h.get('context'):assert encoded[h['contextStart']*2:h['contextStart']*2+len(h['context'].encode('utf-16-le'))].decode('utf-16-le')==h['context']
 old=next((c for c in configs if c['sourceId']==extra['sourceId']),None)
 if old:
  for key in ['municipalityCode','year','evaluationYear','proof','fullTextSha256']:assert old.get(key)==extra.get(key)
  old['rows'].extend(extra['rows']);old['holds'].extend(extra['holds'])
 else:configs.append(extra)
# Preserve unresolved title alternatives as holds, never overwrite the annual production record.
alias_holds={('043082d7600b676b84006c46','生活支援体制整備事業'):'cached-40220-c126f83660d500ec6cbedb00',('043082d7600b676b84006c46','漁場整備事業'):'cached-40220-65739f2908260d3eef84cf68',('26603e3ecc2f657f54d279cc','生活支援体制整備事業'):'cached-40220-413af57865a38cafd64bcea5'}
for c in configs:
 kept=[]
 for r in c['rows']:
  prior=alias_holds.get((c['sourceId'],r['name']))
  if prior:c['holds'].append(dict(start=r['start'],raw=r['raw'],status='identity_alias_hold',reason='Possible same-year existing title with trailing 費: '+prior+'. Preserve original candidate in tested checkpoint 3e100915; do not add or merge until exact programme identity resolved. Existing production values unchanged.'))
  else:kept.append(r)
 c['rows']=kept
 if c['sourceId']=='7f46d30943112fe91b3d425b':
  for h in c['holds']:
   if h.get('status')=='layout_review':h.update(status='reviewed',reason='Remaining title columns reviewed against 361 monetary rows; every row has a title candidate or exact hold. See fukuoka-kama-row-coverage.json and 85-row disposition. Numeric column alignment remains unextracted; finance/carryover/benefit-identity holds preserved.')
# Finish the named-programme review; preserve concrete attribution/period gaps, not a generic layout stop.
for c in configs:
 if c['municipalityCode'] not in ['40625','40342','40220']:continue
 for h in c['holds']:
  if h.get('status')!='layout_review':continue
  h['status']='identity_or_period_hold'
  h['reason']={
   '40625':'Named annual programmes and school-lunch accounting transition reviewed. Remaining 主要施策/主要事業 containers combine previously named child programmes, third-party sports activities and future directions (e.g. 記録保存事業の実施が望まれる). Parent/child identity and interleaved score columns cannot be assigned to extra independent projects without a named individual sheet. No claim of full numerical extraction.',
   '40342':'Annual named programmes reviewed across all ten books. Remaining prefecture-run matchmaking/health-point schemes, citizen-group flower-bed grant components, third-party tourism trials and generic care/forest activities do not prove additional independent municipal identities. Postpartum-care occurrences are next-year plans or consultation, not dated completed provision. Parent grant/programme and subactivity relationships retained; no KPI rows or projected years converted to projects.',
   '40220':'Complete annual implementation sections reviewed for explicit names. Remaining policy headings, general statutory needs, parent programme totals, detached column fragments and future-target statements do not establish an additional unique named annual project. Five-year summary dates are not individual execution years; original numeric alignment still required for unstructured values.'}[c['municipalityCode']]
for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-fukuoka-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const fukuokaRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
