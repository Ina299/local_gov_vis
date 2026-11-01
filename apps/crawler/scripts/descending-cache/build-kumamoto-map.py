import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[4]; docs=root/'apps/web/public/evaluation-evidence/documents';configs=[]
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
def source(id,code,year,proof):
 t=verified_text(id,code);assert proof in t
 expected=next(r for r in json.loads((root/'data/evaluations/descending-offline/43/source-ledger.json').read_text()) if r['sourceId']==id)
 assert hashlib.sha256(t.encode()).hexdigest()==expected['fullTextSha256'],id
 c=dict(sourceId=id,municipalityCode=code,year=year,proof=proof,fullTextSha256=hashlib.sha256(t.encode()).hexdigest(),rows=[],holds=[]);configs.append(c);return c,t
def row(c,t,name,raw=None,note='年度報告の明示された事業名のみ。金額・政策指標・親項目の評価は転記しない。',start=None):
 raw=raw or name;p=t.index(raw) if start is None else start;assert t[p:p+len(raw)]==raw
 c['rows'].append(dict(name=name,start=len(t[:p].encode('utf-16-le'))//2,raw=raw,note=note))
def hold(c,t,raw,reason):
 p=t.index(raw);c['holds'].append(dict(start=len(t[:p].encode('utf-16-le'))//2,raw=raw,reason=reason))
c,t=source('de1bdf07aa6f1c0d39940075','43512',2024,'令和６年度\n\n企画調整課事務報告')
for name in ['電気自動車充電スタンド設置事業','空き家解体補助事業','山江村住宅リフォーム助成事業','山江村観光交流ホームぺージリニューアル業務','交流プロジェクト推進事業','石蔵活用拠点整備事業','農村型地域運営組織（農村 RMO）形成推進事業']:
 if name not in t:print('missing',name);continue
 p=t.index(name);row(c,t,name,t[p:p+min(250,len(t)-p)],note='令和６年度実施内容の記述。石蔵は計画策定段階で、翌年度の設計・施工を完成実績にしない。' if name=='石蔵活用拠点整備事業' else '年度事務報告で明示された個別事業名。寄附充当額や契約額を決算に転用しない。')
for name in ['物価高騰対策給付金（非課税世帯分）7 万円/世帯','物価高騰対策給付金（均等割りのみ世帯）10 万円/世帯','物価高騰対策給付金（こども加算）5 万円/人','やまえ生活支援券（臨時）第 2 弾 8 千円/人','地域公共交通事業者支援','省エネ家電買替支援事業']:
 p=t.index(name);row(c,t,name,t[p:p+len(name)+60],note='令和６年度に実施した事業の名称。省エネ家電は６年度実施分のみで７年度繰越分を含めない。交付金充当額と総事業費は未構造化。')
for raw,reason in [('R6 低所得支援枠','FY2024 administrative cost only; implementation carried into FY2025, funding-window label is not an independent business identity.'),('生活支援券事業 5 千円/人','Administrative expenditure only in FY2024; actual benefit implementation belongs to carryover year and is not proved here.'),('一体支援枠','Combined equal-tax, child addition and adjustment grants; independent identity/parent-child associations unresolved.'),('住まいの再建支援事業（転居費用助成）','Five listed disaster-support grants are FY2024 applications, not evidence of completed expenditure; no amounts or completion inferred.'),('業務委託一覧表','Contract components are not automatically independent budget businesses; cross-contract business identity absent.'),('人吉球磨 10 市町村が一体となった地','Regional council is implementing entity; no independent village project identity inferred from the shared project.')]:hold(c,t,raw,reason)
for id,year in [('e78c9b11dcb5623485440693',2023),('1700a69029923ef7685b96fd',2022)]:
 c,t=source(id,'43511',year,f'五木村過疎地域持続的発展計画における達成状況の評価（令和{year-2018 if False else ("５" if year==2023 else "４")}年度）')
 names=['特定地域づくり事業','移住・定住促進事業','空き家バンク助成事業','地域づくり活動支援事業','人材育成のための研修助成','農林産物活性化事業','産直材、産直住宅の普及推進','特用林産物生産支援事業','有害鳥獣被害対策事業','森林環境保全整備事業','間伐等森林整備促進対策事業','造林事業','道の駅周辺施設改修事業','観光施設等おもてなし向上事業','道の駅指定管理事業','商工業経営持続化支援事業','商工会助成金','観光施設維持管理事業','観光宣伝事業','五木の祭り助成事業','観光振興業務助成事業','ケーブルテレビ共架等の維持管理','タクシー運営補助','くま川鉄道維持・存続','浄化槽普及推進事業','高齢者等住宅改造助成事業','医療機器等整備事業','学校施設等の環境改良','小水力発電施設設置事業']
 if year==2022:names+=['横手公園改修事業','定住促進住宅整備事業']
 if year==2023:names+=['簡易給水施設改修事業（下谷）']
 for name in names:
  if name not in t: print('missing',id,name);continue
  p=t.index(name);row(c,t,name,t[p:p+len(name)+70],note='主な事業名と年度達成状況。設計・協議・整備中を完成に読み替えず、政策指標・複数年度総額は転記しない。')
 for m in re.finditer(r'[①-⑳]([^\n]+)',t):
  if any(m.group(1).startswith(n) for n in names):continue
  raw=m.group();hold(c,t,raw,'Unimplemented/future or multiyear construction, implementation by prefecture, or shared implementation statement; current village annual execution and individual alignment not established. Retain the exact source row, no invented annual result.')
 hold(c,t,'目指す指標','Policy-wide indicators do not identify individual projects or provide transferable project-level values.')
c,t=source('f0f607e1dfab0682fba8c074','43505',2023,'令和５年度 新型コロナウイルス感染症対応地方創生臨時交付金の実施状況、事業実績及び効果検証')
for name,raw in [('多良木町生活困窮者緊急生活支援金事業【低所得者世帯給付金】','多良木町生活困窮\n民税非課税世帯）へ給付金を支給することで、生活\n者緊急生活支援金\nの支援を行う。\n事業【低所得者世帯\n②低所得者世帯への給付金\n給付金】'),('学校給食費に係る子育て世帯家計負担軽減事業','学校給食費に係る\n4 子育て世帯家計負\n担軽減事業'),('ＬＰガス価格高騰対応生活者支援事業','ＬＰガス価格高騰対 ガス協会を通して料金の一部を補助することによ\n5\n応生活者支援事業'),('多良木町家計負担軽減事業','多良木町家計負担\n軽減事業'),('物価高騰対策商品券発行事業','物価高騰対策商品\n券発行事業'),('新型コロナウイルス感染症対策地域公共交通事業者支援事業','新型コロナ\nウイルス感\n染症対策地\n3\n域公共交通\n事業者支援\n事業')]:row(c,t,name,raw)
hold(c,t,'事業（事務費）','Administrative component belongs to same emergency-benefit project; do not add a duplicate business or allocate shared amounts.')

c,t=source('0dbc8a32c8857e99a4e4d476','43506',2023,'令和５年度\n第２期湯前町総合戦略検証結果報告書')
for name,begin,end in [('高齢者の保健事業と介護予防の一体的実施','令和5年度から開始した','行っている。'),('新築応援事業','球磨スギ・ヒノキ需要促進事業が','なった。')]:
 p=t.index(begin);e=t.index(end,p)+len(end);row(c,t,name,t[p:e])
hold(c,t,'重要業績評価指標（KPI）','Policy indicators and population/participation counts lack unique individual-business binding; only the two explicitly named implementation narratives are retained.')
hold(c,t,'若者雇用促進事業の交付件','The source explicitly says the business was not undertaken; do not infer execution from a KPI heading.')
c,t=source('3b0fd2aa705d3c11ca6538c9','43501',2024,'R6年度実績値')
row(c,t,'高齢者タクシー助成事業',t[t.index('高齢者タクシー助成事業'):t.index('高齢者タクシー助成事業')+25],note='令和６年度の利用実績を明記。令和７年度予定・将来目標・再掲を追加年度事業にしない。')
row(c,t,'商工業者支援事業','商工業者支援事業3件\n小規模事業者持続化補助金給付6件')
row(c,t,'小規模事業者持続化補助金','商工業者支援事業3件\n小規模事業者持続化補助金給付6件')
hold(c,t,'Ｒ7年度：1件利用','FY2024 indicator columns coexist with FY2025 narrative updates, historical values and future targets. No other annual project/column associations inferred.')
for id,code,proof,reason in [('a1c5735d02f2eb2ddcd43f94','43513','第３期球磨村人口ビジョン','Prospective FY2024–2028 strategy; previous-strategy review gives aggregate policy indicators, not independently bounded annual business sheets. Named prospective activities lack implementation-year evidence.'),('964850dd23c6dd90e8e88de8','43507','令和３年度 農山漁村振興交付金（山村活性化対策）','Grant-programme assessment names the implementing council and product-development components, not an independent municipal business title. Council/programme identity must not be relabelled as a village business.')]:
 c,t=source(id,code,None,proof);hold(c,t,proof,reason)

c,t=source('416ad9b7aadcd646d5dac85a','43484',2023,'令和 ５年度 評価・検証報告書')
for name in ['熱帯果樹振興事業','地域商社推進事業','低所得世帯等に対する臨時特別給付金【低所得者世帯給付金】','学校給食費補助金','LPガス使用世帯支援事業','保育所給食食材費等支援事業','小規模事業者総合支援補助金','燃油高騰対策支援事業','漁船エンジンオーバーホール補助事業','水産業用機械購入補助事業','農業用機械購入補助事業','農業用資材購入補助事業','農道等原材料支給事業','つなぎ美術館の展覧会事業']:
 p=t.index(name,42000);row(c,t,name,t[p:p+len(name)+70],start=p)
hold(c,t,'低所得世帯等に対する臨時特別給付金（事務費）','Administrative component, not a second project.')
hold(c,t,'Ｒ５～Ｒ６','Four priority-grant rows cross FY2023/FY2024; source does not bind each execution year. Do not assign report year as spending year.')
hold(c,t,'入魂の宿管理運営事業','FY2023 review includes FY2022 funding/startup and cumulative indicators. Annual scope must remain distinct; no FY2023 execution inferred.')
hold(c,t,'園芸振興費','Account heading bundles several subsidies; not an individual business name.')
c['holds'].append(dict(start=0,raw=t[:100],reason='Earlier policy matrices have additional named implementations needing row/alias reconciliation; still actionable layout review, not an evidence/access denial.',status='layout_review'))
c,t=source('1d99976b5b4ad8f4ef8e89c7','43444',None,'（令和４年12月）');c['evaluationYear']=2022
for name in ['農産物のブランド化・販路拡大','農業等の人材育成','移住定住促進事業','井戸江峡キャンプ場整備']:
 p=t.index(name);row(c,t,name,t[p:p+len(name)+100],note='構成事業名を保持。評価は2022年12月、複数年度合算額を単年度決算にしない。')
 if name=='井戸江峡キャンプ場整備':c['rows'][-1]['year']=2019;c['rows'][-1]['yearProof']='R1年度に施設整備を完了'
hold(c,t,'緑の川と山の都のブランド創造','Regional parent project not added separately from named constituent projects; FY2017–2021 aggregate cannot prove individual annual executions.')
hold(c,t,'企業版ふるさと納税基金積立','Reserve deposit is not an implemented individual project; later applications unspecified.')

c,t=source('6492f848af6c367857a37e10','43443',2024,'令和６年度 益城町物価高騰対応重点支援地方創生臨時交付金 事業実績及び効果検証')
for name,raw in [('益城町LPガス価格高騰対応生活者支援事業（追加経済対策分）','益城町LPガス価格高騰対応生活\n企画財政課\n（事務費内訳）\nメニュー分\n者支援事業（追加経済対策分）'),('物価高騰対応学校給食費支援事業','物価高騰対応学校給食費支援事 ら除く）。\n学校教育課\nメニュー分\n業'),('省エネルギー機器設置支援事業','省エネルギー機器設置支援事業'),('交通不便地域における公共交通実証実験事業','交通不便地域における公共交通 もに、他公共交通機関との接続性を高めることにより、他事業者の乗客\n企画財政課\n実証実験事業'),('子ども医療費助成事業（高校生世代分）','子ども医療費助成事業\n（高校生世代分）'),('憩いの家光熱水費補助事業','憩いの家光熱水費補助事業')]:row(c,t,name,raw)
hold(c,t,'※No.15と同一事業','Explicit repeated funding portion of the same medical assistance, not an extra project.')
hold(c,t,'R5、R6の累計給付金額','Benefit rows use cumulative FY2023/FY2024 amounts and repeated titles; later rows end in FY2025. Row-year/identity reconciliation required, no report-year spending inference.')
c['holds'].append(dict(start=0,raw=t[:100],reason='Remaining named rows with later-period ends still need source-specific annual mapping.',status='layout_review'))
c,t=source('4ee237a1861d1f65000152a4','43441',2023,'令和5年度新型コロナウイルス感染症対応地方創生臨時交付金実施状況及び効果検証')
for name,raw in [('御船町地域公共交通経営支援事業','御船町地域公共\n3 交通経営支援事\n業'),('物価高騰の影響による私立保育所等支援事業','物価高騰の影響\n高騰に伴う経済負担増によりひっ迫している保育\n4 による私立保育所\n所等に対し、食材費及び光熱水費・燃料費の価格\n等支援事業'),('子育て世帯応援給付事業','子育て世帯応援\n5\n給付事業'),('御船町指定ごみ袋販売事業','御船町指定ごみ\n6\n袋販売事業'),('経営所得安定対策等推進事業に取り組む農業者支援事業','経営所得安定対\n新型コロナウイルス感染症の影響等による原油\n策等推進事業に 及び物価高騰の影響を受けながらも経営所得安\n取り組む農業者支 定対策等推進事業に取り組む農業者に対し、1経\n援事業'),('LPガス使用世帯支援事業','LPガス使用世帯\n支援事業'),('電子入札事業','電子入札事業')]:row(c,t,name,raw)
for raw in ['令和五年度御船町電','電力・ガス・食料品等 新型コロナ']:
 hold(c,t,raw,'Several low-income benefit titles differ in eligible households and additional payments; preserve parent/child identity until reconciled, rather than add funding components as separate businesses.')

for id,year,items in [
 ('17f558ee47bccb04ffc3094a',2016,[('南阿蘇村創生プロジェクト推進事業','南阿蘇村創生プロ\nジェクト推進事業')]),
 ('e1a5ccd628968d3aa8ee2acd',2017,[('南阿蘇村創生ﾌﾟﾛｼﾞｪｸﾄ','南阿蘇村創生ﾌﾟﾛｼﾞｪｸﾄ')]),
 ('67db28faed0ada265ca72574',2018,[('南阿蘇村創生プロジェクト','南阿蘇村創生 磨き上げや販路開拓、人材育成\nプロジェクト'),('熊本地震の震災遺構等を活用した回廊型フィールドミュージアムによる交流人口拡大プロジェクト','熊本地震の震\n災遺構等を活\n用した回廊型\nフィールド\nミュージアム\nによる交流人\n口拡大プロ\nジェクト')]),
 ('e76b6e800443848dc61e1825',2021,[('熊本地震の震災遺構等を活用した回廊型フィールドミュージアムによる交流人口拡大プロジェクト','R3\n\n熊本地震の震\n災遺構等を活\n用した回廊型\nフィールド\nミュージアム\nによる交流人\n口拡大プロ\nジェクト')]),
 ('9649da7dab7c7e74fd23f1cd',2023,[('コンビニエンスストア等での証明書等交付サービス','コンビニエン\nスストア等で\nの証明書等交\n付サービス'),('コンビニ収納サービス','コンビニ収納\nサービス'),('大草原が育む食と自然のエシカルビレッジ事業','大草原が育む ナンバーカード）を活用した関与プ\n食と自然のエ ロセスの設計及びエビデンスに基づ\nシカルビレッ いた政策立案、さらには様々な人材\nジ事業')])]:
 c,t=source(id,'43433',year,'●検証結果')
 page=json.loads((docs/'84cef70c850e242e618a0aa4.json').read_text())['text'];c['pageId']='84cef70c850e242e618a0aa4';c['pageHash']=hashlib.sha256(page.encode()).hexdigest();c['pageProof']=(f'平成{year-1988}' if year<2019 else f'令和{year-2018}')+'年度実施事業 検証結果';assert c['pageProof'] in page
 for name,raw in items:row(c,t,name,raw,note='保存済み公式案内ページのリンク年度と原典行の年度を照合。本文引用の事業名称のみ。事業全体の金額や将来効果を推測しない。')
 if year in [2016,2017]:hold(c,t,'阿蘇地域' if year==2016 else '熊本県及び阿蘇郡市町村','Regional council/prefecture implements shared projects; independent village implementation identity needs evidence, no regional total assigned to village.')
 if year==2018:hold(c,t,'３つのハード事業については','Three completed facilities begin operation in FY2019 and are explicitly deferred for evaluation; operations/year/cost associations not guessed from FY2018 report title.')
 if year==2021:hold(c,t,'R2 フィールド\n繰越','FY2020 carryover row of same museum project; do not add a second FY2021 identity or assume execution in FY2020.')
 if year==2023:
  c['evaluationYear']=2024
  for r in c['rows']:r['yearProof']='令和６年１０月１７日'

c,t=source('5aab1d66f2b6b5e98676955f','43428',None,'事後評価実施時期\n\n令和7年度');c['evaluationYear']=2025
row(c,t,'空き店舗改修事業','□提案事業（地域創造支援事業）\n空き店舗改修事業',note='都市再生整備計画で明記された提案事業。評価年度2025のみで、FY2021–2022の交付期間を単年度実績に割り当てない。地区全体の交付額・KPIを個別事業にしない。')
hold(c,t,'高森駅前広場、高森駅前駐車場、情報板設置、地域防災施設、緑化施設等、照明施設等','Facility components and collective workshops lack separate independent budget-business identities/annual executions. The district-wide cost and KPI totals cannot be allocated to components.')

c,t=source('54ac3b3d9919e322a5c9c0f7','43425',2021,'★★令和３年度 新型コロナウイルス感染症対応地方創生臨時交付金 実施状況と効果検証★★')
names=['コミュニティバス感染症対策消耗品購入','産山村公式サイトリニューアル','送料無料キャンペーン事業','修学旅行感染防止対策事業','成人式新型コロナ感染予防対策事業','産山学園換気用網戸設置工事','新型コロナワクチン接種会場感染防止対策事業','外出支援及び診療所等車両空間整備事業','地域の感染状況等を踏まえたきめ細かい医療提供体制等構築事業','営業時間短縮要請協力金','選挙実施における感染症拡大防止対策','畜産経営持続化支援事業','高校生等がんばれ助成支援事業','住民健診実施における感染症拡大防止対策事業','地域の特産品魅力発信事業','産山村小さな拠点における交流スペース及び販売コーナーの備品購入費','地域情報のデジタル技術活用推進事業','乳幼児・児童・生徒医療費等助成支援事業','感染防止対策会議等促進事業','コロナウィルス感染症予防事業','特定事業所継続維持支援事業','公共施設等の管理維持体制持続化事業支援金事業','地域介護予防活動での感染防止対策','医療機関等への新型コロナウイルス感染症対策支援','子育て世帯臨時特別給付金事業','事業者等支援事業','産山学園・うぶやま保育園感染対策支援事業']
for name in names:
 m=re.search(r'\s*'.join(re.escape(ch) for ch in name),t);assert m,name
 row(c,t,name,m.group(),start=m.start())
hold(c,t,'* ＮＯ22の事業と併せて実施','Rows22/30/31 explicitly share one business. Keep one name/year, no duplicate funding records or guessed summed costs.')
hold(c,t,'* ＮＯ22の事業の通常分と併せて実施','Third funding component of the same business, not an independent project.')

c=configs[0];t=json.loads((docs/(c['sourceId']+'.json')).read_text())['text']
for r in c['rows']:
 if r['name']=='山江村観光交流ホームぺージリニューアル業務':r['year']=2023;r['yearProof']='令和５年度において';r['note']='本文でリニューアルは令和５年度と明記。令和６年度は運営・保守。報告表紙の年度を改修年度にしない。'
for name in ['広報やまえの発行','地方公共団体情報システムの標準化・共通化に係る事業','安全管理措置の点検監査業務','総合行政システム機器更新事業','グリーンな栽培体系への転換サポート事業','やまえ栗アンバサダー事業','太陽光発電システム設置費補助金','山江村再生可能エネルギーゾーニング計画策定','公共施設太陽光発電導入可能性調査','復興ポータルサイト「鎮山親水」','地域づくり活動補助金']:
 m=re.search(r'\s*'.join(re.escape(ch) for ch in name),t);assert m,name
 end=min(m.end()+150,len(t));row(c,t,name,t[m.start():end],start=m.start(),note='明記された年度内の調査・準備・運営・補助の実施。設備や制度の完成、費用・成果値を推測しない。')
for raw,reason in [('山江村ふるさと応援寄附金','Donation categories are revenue/use categories, not independent businesses; component contracts and prior named projects must not be duplicated.'),('ボンネットバス「マロン号」','Annual report contains explicit prior-FY2023 operational narrative alongside FY2024 events; no single current annual business identity/period inferred.'),('地域づくり研究所関係','Consortium and residents council activities do not establish separately funded village businesses; parent programme/subactivities and implementing entity need explicit mapping.'),('国勢調査（準備）','Upcoming survey is FY2025; current preparation not treated as completed FY2024 survey.'),('山江村移住定住促進事業','Parent migration programme includes previously selected empty-home subsidy plus several services; independent parent/child identity not inferred.'),('丸岡会関係','Association meetings and member rosters are not individual municipal business sheets.'),('ひごラボ Next','Regional collaborative project/meeting participation, not evidence for independent municipal business identity.'),('山江村特産品等出店事業助成金交付実績','Zero application count is explicit; no completed subsidised execution invented.')]:hold(c,t,raw,reason)

c=next(c for c in configs if c['sourceId']=='6492f848af6c367857a37e10');t=json.loads((docs/(c['sourceId']+'.json')).read_text())['text']
c['rows']=[r for r in c['rows'] if r['name']!='憩いの家光熱水費補助事業'];c['holds']=[h for h in c['holds'] if h.get('status')!='layout_review']
row(c,t,'私立保育所等物価高騰対策支援事業','私立保育所等物価高騰対策支援\nこども未来課\n・光熱費：利用定員による補助2,000千円（うち県補助金1,000千円）\n事業')
hold(c,t,'憩いの家光熱水費補助事業','Operating costs refer FY2024 but project end dates extend into FY2025; annual execution/payment identity must not be assumed from report heading. Same issue for cultural hall and sports-facility utility grants.')
c=next(c for c in configs if c['sourceId']=='416ad9b7aadcd646d5dac85a');t=json.loads((docs/(c['sourceId']+'.json')).read_text())['text']
selected=[('果樹栽培施設維持対策事業補助金',1967),('中山間地域直接支払事業',2189),('多面的機能支払事業',2224),('農道等生コン支給事業',2289),('優良品種計画更新事業補助金',3922),('柑橘安定出荷販売支援事業補助金',3997),('農業次世代人材投資資金事業',4477),('森林環境保全直接支援事業',6389),('再造林等促進事業補助金',6442),('森林経営管理事業',6461),('マガキ養殖推進事業補助金',8555),('漁船保険補助金',8881),('漁業後継者対策事業補助金',8977),('地域商社販売力強化施設導入補助金',10728),('企業立地促進補助金',11071)]
for name,begin in selected:
 p=t.index(name,begin);row(c,t,name,t[p:p+len(name)+100],start=p)
c['holds']=[h for h in c['holds'] if h.get('status')!='layout_review']
for raw,reason in [('機械購入事業23件','Agricultural machine/material figures include reprints and overlap grant-row projects; independent identity/funding components not proved.'),('漁船オーバーホール事業補助金','Fishery support titles overlap grant-table projects with variant names and amounts. No additional alias records or allocated totals.'),('具体的な施策・事業','Policy matrices mix future measures, parent programmes, actual narrative and cumulative assessments. Remaining unbounded items need individual project/column binding; policy titles and meetings are not business sheets.'),('■施策の効果検証と今後の方向性','Cumulative policy grades and KPI values cannot be assigned to individual business names; retain only individually proved literal names, no shared scores.')]:hold(c,t,raw,reason)

c,t=source('e753806dc3468c4ea6875a1d','43423',2024,'《令和６年度の実績や課題など》')
for name in ['日本で最も美しい村補助金','中山間地域等直接支払制度交付金','林業機械導入事業補助金','南小国町タクシー利用券','コンビニ収納システム','コンビニ交付サービス','まちインターン事業','農業体験民泊事業','里山自然体験活動事業','夢チャレンジ推進事業補助金','太陽光発電設備等導入促進事業補助金','ペレットストーブ等購入補助事業','民間賃貸住宅確保プロジェクト']:
 m=re.search(re.escape('里山自然体験\nこんべい村でのアウトドアクッキング体験\n活動事業') if name=='里山自然体験活動事業' else r'\s*'.join(re.escape(ch) for ch in name),t);assert m,name
 row(c,t,name,m.group(),start=m.start(),note='令和６年度の実績記述を持つ個別サービス・補助事業名。コンビニサービスは当年度運用の対象で、当年度新設とはしない。政策章・将来計画・工事完了を推測しない。')
 # Preserve the closest following annual implementation paragraph, not just report heading.
 actual=t.index('《令和６',m.end());end=t.find('\n・',actual+1);end=len(t) if end<0 else end
 c['rows'][-1]['contextStart']=len(t[:actual].encode('utf-16-le'))//2;c['rows'][-1]['context']=t[actual:min(end,actual+550)]
hold(c,t,'令和７年度に未施工の舗装工事','Road report mixes prior FY2023 works, FY2024 carryovers and FY2025 completion; no complete-road or yearly-cost inference.')
hold(c,t,'【き】築いてきた美しい里山','Broad policy headings, joint regional actions, facilities, meetings and constituent events are not separate business records without individual identity binding.')
c,t=source('ba323743a99a95d1cf5f5628','43423',None,'令和７年度の総合計画効果検証について');hold(c,t,c['proof'],'Schedule and instructions for preparing future evaluations, not completed individual business sheets.')
c,t=source('b82a5c1201ce18495b96c81f','43423',None,'総合計画重点事業一覧（2023年度（令和５年度）事業実績評価書 兼 2024年度（令和６年度）事業実施計画書）')
hold(c,t,'2023年度事業実績・成果、2024年度の変更点等（下段）','Header calls the rows FY2023 actual/FY2024 plan, while several narratives explicitly describe FY2024 execution. Other rows lack a decisive year; do not assign one blanket annual scope.')
for name in ['未来づくり事業','学校給食提供環境整備事業']:
 m=re.search(r'\s*'.join(re.escape(ch) for ch in name),t);assert m,name
 row(c,t,name,m.group(),start=m.start(),note='本文が令和６年度の活動・検討と明記する範囲のみ。学校給食は移転先等の検討段階で工事完了ではない。表見出しとの年度不一致を保持し、金額・KPI・評価点を転記しない。');c['rows'][-1]['year']=2024
 c['rows'][-1]['yearProof']='・令和6年度は、6名の起業型地域おこし協力隊' if name=='未来づくり事業' else '令和６年度は今後の方向性を示すに留まっ'

c,t=source('60c979cb67321adea4cb5a6a','43423',2024,'2024年度(令和６年度)')
for name in ['特定創業支援等事業','ワーキングバケーション事業']:
 p=t.index(name);row(c,t,name,t[p:p+len(name)+170],start=p)
hold(c,t,'日本で最も美しい村','Policy summary repeats literal services already documented by the implementation report, including taxi, solar, dream-challenge and school activities. Parent-policy KPIs/budgets and title aliases are not extra businesses.')
c,t=source('c3f67bd4a7bda11d6e066155','43423',None,'重点事業等予算内訳書');hold(c,t,'※終了年度は最終補正後の額','Budget-only component/parent tables with reprints and mixed past/future fiscal columns, not proof of actual expenditure. They overlap named service candidates; no new projects/actual costs from budget components.')
c,t=source('ac6d31b759f1531572f4490e','43403',None,'平成２８年度\n\n基本事業評価調書');c['evaluationYear']=2016
selections={
1:'社会福祉協議会補助事業|民生委員児童委員活動補助事業|心配ごと相談事業|災害時避難行動要支援者支援事業|ひとり親家庭等医療費助成事業|障害福祉サービス事業|地域生活支援事業|補装具費給付事業|自立支援医療費給付事業|重度心身障害者医療費助成事業|障害者相談支援事業|地域療育推進事業|障害児支援費事業|障害者住宅改造助成事業|社会参加促進事業|老人福祉センター運営事業|児童手当支給事業|若草児童学園管理運営事業',
2:'予防事業対象者把握事業|通所型介護予防事業|訪問型介護予防事業|生活管理指導員派遣事業|総合相談事業|成年後見制度支援事業|食の自立支援事業|ほっとライン体制整備事業|包括的支援事業',
3:'老人クラブ運営補助事業|敬老事業|金婚表彰事業|老人保護措置事業|シルバー人材センター育成事業|高齢者生きがいセンター指定管理委託|生活管理指導短期宿泊事業',
4:'楽善ふれあいプラザ指定管理委託事業|高齢者住宅改造助成事業|家族介護用品支給事業',
5:'特定健診、特定保健指導事業|国民健康保険健診事業（人間ドック）|国民健康保険保健事業（鍼灸施術補助）|後期高齢者医療健診事業|後期高齢者医療保健事業（鍼灸施術補助）',
6:'母子保健事業|地域救急医療対策事業|予防接種事業|健康増進事業|食品監視活動補助金|新型インフルエンザ発熱外来事業|自殺対策推進事業',
7:'こども医療費助成事業',8:'大菊土地改良区助成金|土地改良事業補助金|多面的機能支払交付金事業',
10:'担い手育成総合支援事業|農業後継者育成事業|認定農業者協議会事業|農業制度資金利子補給事業|人･農地問題解決推進事業',
11:'農産振興対策事業|畜産振興対策事業|経営所得安定対策推進事業|家畜防疫・畜産一般事業',
12:'山村広場維持管理事業|有害鳥獣捕獲事業|鳥獣害防止対策事業',
14:'町有林保育事業|地域活動支援交付金事業|私有林間伐促進事業|作業道舗装事業|森林環境保全整備事業',15:'森林公園整備事業',
16:'消費者動向調査|大津町中小企業新築店舗改装利子補給',17:'大津町工場等振興奨励事業',20:'祭り助成金|観光協会設立に関する事業',
22:'社会調査及び研究事業|各種相談事業|地域交流事業|地域福祉事業|住民啓発及び広報活動事業|児童健全育成事業|子育て支援事業',
24:'海外派遣助成事業|国際交流員招致事業',25:'都市計画マスタープラン策定業務|立地適正化計画策定業務|国土利用計画策定業務|都市計画基礎調査策定業務|都市計画図作成事業',
26:'住宅用省エネシステム設置補助制度',27:'白川中流域の水田湛水事業|合併浄化槽設置補助事業|雨水浸透桝設置補助事業',
30:'社会資本整備事業に基づく道路新設事業|交通安全施設整備事業|道路改良事業|道路補修事業|橋梁長寿命化事業',
33:'都市計画道路駅前楽善線改良事業|町道門出２号線道路整備事業',34:'駅前広場整備事業|南口駅（ビジターセンター）建設事業|駅北口整備事業',
35:'町立公園等管理委託事業|公園長寿命化計画策定事業',38:'簡易水道整備事業',39:'公共下水道事業|農業集落排水事業',40:'消防施設整備事業|防災基盤整備事業',41:'防犯灯設置及び管理事業',44:'地域防犯対策事業',45:'事務改善事業|行政評価事業',47:'総合行政システム事業|地域情報化整備事業',50:'町民相談事業|総合窓口化の推進事業',52:'公会計整備事業',53:'大津町新地方公会計整備支援業務|公用自動車整備事業',55:'庁議システム事業|振興総合計画策定・進行管理事業|行政評価事業|公共交通計画事業|統計調査事業|人づくりまちづくり事業|広報発行事業',58:'地域づくり活動支援事業|元気大津づくり活動事業（地域通貨「水水」）'}
ms=list(re.finditer('構成事務事業',t));assert len(ms)==58
seen=set()
for n,m in enumerate(ms,1):
 end=t.index('基本事業の成果指標',m.end());b=t[m.end():end];b=re.split('27年度決算|２７年度決算|28年度予算',b)[0];start=m.end()
 for name in selections.get(n,'').split('|'):
  if not name or name in seen:continue
  pat=r'(?:\s|事務事業名)*'.join(re.escape(ch) for ch in name);q=re.search(pat,b);assert q,(n,name)
  row(c,t,name,q.group(),start=start+q.start(),note='平成28年度評価調書の「構成事務事業」欄に明記された個別名。評価年度2016のみ。平成27年度合計決算や28年度予算、基本事業全体の評価・指標を各事務事業へ転記しない。');seen.add(name)
 c['holds'].append(dict(start=len(t[:start].encode('utf-16-le'))//2,raw=b,reason=f'Sheet {n}: named constituents screened; parent basic-policy name, account/fund labels, shared finance, prefectural works and activity directives omitted. This list alone does not establish individual fiscal execution or individual scores.',status='reviewed_constituent_list'))

# Nagomi: complete hash-verified books, explicitly numbered municipal budget businesses.
import unicodedata
for id,year,digit in [('97473d4c47a291cc66e118f1',2022,'４'),('923cb11b38ca6e22558236a2',2023,'５'),('2fe88363280da148c8e84b12',2025,'７')]:
 c,t=source(id,'43369',year,f'令和{digit}年度\n主要施策成果報告書'); entries=[]
 for m in re.finditer(r'^.*事業№[^\n]*',t,re.M):
  raw=m.group(); q=re.fullmatch(r'[①-㊿]?\s*事業№\s*([0-9０-９]+)[＿_ ]+(.+)',raw)
  if not q:
   hold(c,t,raw,'Business-number line is not a bounded title; missing title boundary or combined numbered headings.');continue
  code=unicodedata.normalize('NFKC',q[1]);name=re.sub(r'\s+[0-9０-９,，]+\s*円.*$','',q[2]).strip()
  if re.search(r'について|事業№|、|繰越|うち支所|人件費|基金積立|繰出金|元金償還|利子償還',name):
   hold(c,t,raw,'Combined/continuing funding portion, staff/account transfer, or narrative reference: independent annual project identity not asserted.');continue
  if not name or re.search(r'[0-9０-９,，]+\s*円',name):
   hold(c,t,raw,'Name/amount boundary unresolved; numeric columns are not inferred.');continue
  entries.append((code,name,raw,m.start()))
 bycode={}
 for code,name,raw,pos in entries:bycode.setdefault(code,set()).add(name)
 seen=set()
 for code,name,raw,pos in entries:
  if len(bycode[code])>1:
   hold(c,t,raw,'Same explicit business number has differing saved titles; alias/department scope needs resolution before separate identities.');continue
  if code in seen:
   hold(c,t,raw,'Repeated business number/title within annual book; retained once, departmental amounts not summed.');continue
  seen.add(code);row(c,t,name,raw,start=pos,note='年度主要施策成果報告書の事業番号付き名称。独立した予算事業の存在のみ保持し、構成費・人件費・合計決算・過年度比較値は転記しない。')
(root/'apps/crawler/src/evaluations/expansion/descending-kumamoto-map.ts').write_text('export const kumamotoRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print([(c['sourceId'],len(c['rows']),len(c['holds'])) for c in configs])
