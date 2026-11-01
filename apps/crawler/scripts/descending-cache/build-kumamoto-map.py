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
# Reviewed after 1123 snapshot; integrate only after active regression finishes.
for id in ['c4c2d75622def90c98878c4e','a1eba989d1e2110528eb6c20','c5ff245e7b122260152cf77f','159dbbfecfe6b24304aa9358']:
 t=verified_text(id,'43368');c,t=source(id,'43368',None,t.splitlines()[0]);hold(c,t,t,'Adopted project plan, not completed evaluation: multiyear planned costs and target KPIs cannot establish annual implementation or actual expenditures. Require execution/evaluation evidence before annual record creation.')
c,t=source('c908ef3ca96612fb56290d49','43367',None,'108,267');hold(c,t,t,'Cached extraction contains numeric cells only; Japanese project names, year labels and column labels are absent. Need original readable text/coordinates to bind any numbers; no municipal fetch authorized.')
c,t=source('533b33aa7ee973f0d7cc699c','43367',None,'平成25年度');hold(c,t,t,'Aggregate evaluation classification counts and definitions, no individual business names. Cannot turn 59 aggregate counts into business identities.')
c,t=source('9ace58f243a84d61ce93d4fa','43367',None,'平成２５年度 事務事業評価(補助金）の対象事業の評価結果について');c['evaluationYear']=2013
for name,raw in [
('交通安全協議会補助','交通安全協議会 交通安全協議\n補助'),('地域安全活動助成','地域安全活動助 地域安全活動\n成'),('消防団補助','消防団補助'),('たばこ販売組合補助','たばこ販売組合 たばこ売上促進 たばこ販売組\n補助'),('社会福祉協議会補助','社会福祉協議会 社会福祉協議\n補助'),('遺族会補助','遺族会補助'),('母子・寡婦福祉協議会補助','母子・寡婦福祉 母子・寡婦福祉\n寡婦福祉協議\n協議会補助'),('身体障害者福祉協議会補助','身体障害者福祉\n祉協議会補助\n協議会補助'),('精神障害者家族会補助','精神障害者家族 精神障害者家\n会補助'),('部落解放同盟支部補助','部落解放同盟支 部落解放同盟\n部補助'),('敬老事業実施団体への補助','敬老事業実施団\n敬老会補助金\n体への補助'),('老人クラブ活動費補助','老人クラブ活動\n費補助'),('元気宅配便支援事業','元気宅配便支援 活き活き輝きボ 南関町老人ク\n改善して継続\n改善して継続\nランティア活動 ラブ連合会\n（統合）\n事業'),('シルバー人材センター補助','シルバー人材セ シルバー人材セ\nバー人材セン 現状維持\n現状維持 いて見直しを視野に入れた検討\nンター補助'),('有害鳥獣捕獲補助','有害鳥獣捕獲補 有害鳥獣捕獲\n助'),('担い手育成総合支援','担い手育成総合\n支援'),('水田農業推進事業','水田農業推進事\n業'),('緑の少年団補助','緑の少年団補助'),('土地改良区事業','土地改良区事業'),('商工会補助','商工会補助'),('TMO事業補助','TMO事業補助'),('婦人会研修費補助','婦人会研修費補 婦人会研修費\n助'),('民芸保存会補助','民芸保存会補助'),('子ども会連合会補助','子ども会連合会 子ども会連合会 南関町子ども\n補助'),('町体育協会補助','町体育協会補助')]:
 row(c,t,name,raw,note='平成25年度の評価対象事業名称のみ。補助団体を事業名に置換せず、実施年度・一次/二次評価の列対応は推定しない。')
hold(c,t,'南関町産業経済費補助金','Rows19–32 give beneficiary organisations under merged programme cells, not separate business titles. Do not invent one project per beneficiary.')
hold(c,t,'総合的な学習事','Rows48–52 share a title across school beneficiaries; distinct project identity versus beneficiary breakdown unresolved.')
hold(c,t,'まつり補助','Repeated generic festival title has different grant names; relation to existing projects requires identity evidence, no name-based double counting.')
hold(c,t,'自衛隊父兄会','Other remaining interleaved title/subsidy/organisation columns cannot be safely separated from cached text alone; ratings and costs unassigned.')
c,t=source('4ae74d4d13d038889d95641a','43364',2023,'R5.12.1')
row(c,t,'物価高騰対応重点支援臨時給付金','物価高騰対応重\n1 点支援臨時給付\n金');c['rows'][-1]['yearProof']='R6.3.31'
row(c,t,'町内小中学生の給食費補助事業','給食費補助事業',note='同一表の町内小中学生の給食費補助事業。始終期R5.4.1–R6.3.31のみを年度根拠とし、金額は列混在のため不採用。');c['rows'][-1]['yearProof']='R5.4.1'
hold(c,t,'住民税均等割の','Remaining benefit rows span fiscal years or duplicate parent/addition/cumulative eligibility components in FY2024 book; precise annual identity unresolved.')
hold(c,t,'ＬＰガス世帯支','Title fragments and other row labels interleaved; complete title/column boundary needs coordinate evidence, no inferred concatenation.')
c,t=source('d2b91e33c6420ee2f805d27e','43364',2024,'R6.10.1')
row(c,t,'玉東町内買物券事業（物価高騰対応）','玉東町内買物券事業\n（物価高騰対応）');c['rows'][-1]['yearProof']='R7.3.31'
hold(c,t,'R5、R6の累計給付金額','Benefit rows combine prior/current year components also printed in previous book; annual business identity not safely separated, no sums.')
hold(c,t,'R7.12.31','FY2024-labelled benefit runs through FY2025; execution-year allocation absent.')
hold(c,t,'R8.2.12','LP-gas grant crosses FY2024–2025 and repeats earlier source fragments; annual identity held.')
c,t=source('675318a6ecc8004d1a29f33e','43348',2024,'令和６年度物価高騰対応重点支援地方創生臨時交付金効果検証資料')
for name,raw,year,proof in [('地域通貨補助金（重点支援）','地域通貨補助金\n\nの生活支援と、地元店舗利用の喚起により、町内事\n\n（重点支援）',2025,'R7.4.1'),('物価高騰対応LPガス使用世帯支援事業','物価高騰対応LPガス使用世帯支\n\nし、料金の一部を補助することにより、経済\n\n援事業補助金',2025,'R8.1.6'),('物価高騰対策給⾷費補助金','物価高騰対策給⾷\n\nう給⾷費値上げによる経費の一部を町が補助するこ\n\n費補助金',2024,'R6.5.1'),('保育所等給⾷費支援事業補助金','保育所等給⾷費支\n援事業補助金',2025,'R7.8.8')]:
 row(c,t,name,raw,note='交付枠年度と実施年度を区別。保存済み表の始終期が属する年度のみを採用し、金額は未構造化。');c['rows'][-1].update(year=year,yearProof=proof)
hold(c,t,'物価高騰対応重点','Three benefit rows have system-only/cross-year/cumulative components; existing FY2023/FY2024 grants may overlap, no new identity inferred.')
c,t=source('ed290621949ab29343f6ad91','43348',2024,'令和5年度物価高騰対応重点支援地方創生臨時交付金効果検証資料')
row(c,t,'物価高騰対応LPガス使用世帯⽀援事業','物価高騰対応LPガ\n6\n\nス使用世帯⽀援事\n業');c['rows'][-1]['yearProof']='令和6年11⽉25⽇'
row(c,t,'地位通貨補助⾦（重点⽀援）','地位通貨補助⾦\n（重点⽀援）',note='原典の「地位通貨」表記を保存。令和6年4月4日–令和7年2月18日の実施期間。既存「地域通貨」との同一性は自動補正せず保留対象。');c['rows'].pop();hold(c,t,'地位通貨補助⾦','Source typo/alias versus regional-currency grant unresolved; do not add separate project for printed typo.')
hold(c,t,'物価高騰対応重点','Benefit rows include cumulative years, child additions, system-only expense and implementation-start/end contradictions. Parent identity and annual execution remain unresolved.')
c,t=source('77f6916c3ef1f06fe9e53ece','43348',2023,'令和5年度新型コロナウイルス感染症対応地方創生臨時交付金効果検証資料')
for name,raw in [('美⾥町電⼒・ガス・⾷料品等価格高騰重点支援事業【低所得者世帯給付⾦】','美⾥町電⼒・ガ\nス・⾷料品等価格\n1\n\n事業\n\n交付対象事業の名\n\n高騰重点支援事業\n【低所得者世帯給\n付⾦】'),('地域通貨補助事業','地域通貨補助事業'),('農業⽔利施設電気料⾦高騰対策事業','農業⽔利施設電気\n料⾦高騰対策事業'),('物価高騰対策給⾷費補助事業','物価高騰対策給⾷\n費補助事業'),('副⾷費負担軽減事業','副⾷費負担軽減事 を受けた児童の家庭に対し、副⾷費を町が補助することによ\n業')]:row(c,t,name,raw)
hold(c,t,'（事務費）','Administrative component of low-income grant, not another project.')
hold(c,t,'保育料負担軽減事','Age-group and funding-window components of same childcare-fee relief; no independent projects inferred.')
hold(c,t,'学校給⾷費補助事','Remaining school-meal and LP-gas title fragments cross narrative/row order; exact title plus period mapping requires further coordinate evidence.')
# Misato individual names with bounded annual dates; other interleaved rows remain an explicit review queue.
for id,year,proof,names in [
 ('b8630489a55325545030c804',2022,'令和4年度新型コロナウイルス感染症対応地方創生臨時交付金効果検証資料',['消費喚起事業','地域環境整備事業','エアコン洗浄事業']),
 ('79b0ada6b7b9a42cac24f548',2021,'令和3年度新型コロナウイルス感染症対応地方創生臨時交付金効果検証資料',['中央庁舎網戸設置事業','地域環境整備事業','避難所整備事業','消費喚起事業','オートサイト区画整理事業']),
 ('1b4f89554a93c02fa1743c86',2020,'令和2年度新型コロナウイルス感染症対応地方創生臨時交付金効果検証資料',['地域環境整備事業','防災活動支援事業'])]:
 c,t=source(id,'43348',year,proof)
 for name in names:row(c,t,name,note='個別事業名称と同年度内の始終期を確認した範囲のみ。交付枠を全行の実施年度に適用せず、列順が崩れた金額は採用しない。')
 c['holds'].append(dict(start=0,raw=t[:150],status='layout_review',reason='Remaining individual rows still actionable: wrapped/interleaved names and cross-year start/end columns require row-specific review. This source is not exhausted and not access-blocked.'))
c=next(c for c in configs if c['sourceId']=='b8630489a55325545030c804');t=verified_text(c['sourceId'],'43348')
for name,raw in [('マイナンバーカード取得促進事業','マイナンバーカー\nド取得促進事業'),('感染予防消耗品購⼊事業','感染予防消耗品購\n⼊事業'),('⾏政デジタル化推進基盤整備事業','⾏政デジタル化推 する基礎を構築するため、書⾯や対⾯、押印の⾒直し及びオ\n進基盤整備事業'),('社会教育施設感染症対策事業','社会教育施設感染\n症対策事業'),('やすらぎ交流体験施設感染症予防対策事業','やすらぎ交流体験\n15\n\n施設感染症予防対\n策事業'),('Ｂ＆Ｇ海洋センター体育館トイレ洋式化事業','Ｂ＆Ｇ海洋セン\n16\n\nター体育館トイレ\n洋式化事業'),('非接触型レジ導⼊事業','非接触型レジ導⼊ ウイルス感染症の感染拡⼤を防ぐため。非接触型のレジシス\n事業'),('コンビニ収納・スマホ決済導⼊事業','コンビニ収納・ス サービスの充実と利便性を向上させるため、税・料⾦につい\nマホ決済導⼊事業'),('QRコード決済事業','QRコード決済事業'),('感染防⽌対策支援員派遣事業','感染防⽌対策支援\n員派遣事業'),('学校運営に伴う感染症対策に係る支援事業','学校運営に伴う感 ①各学校や⾏事において新型コロナウイルス感染症対策の徹\n21\n\n染症対策に係る支 底を⾏うため感染予防のための消耗品を購⼊する\n援事業'),('ICT支援員委託事業','ICT支援員委託事\n業')]:row(c,t,name,raw,note='令和4年度実施期間の個別名。次年度の利用実績を当年度実績へ転用せず、金額は保存引用のみ。')
for name in ['ワクチン接種会場への移動支援事業','テレワークサービス利⽤事業','東部地区活性化施設改修事業','ｷｬﾝﾌﾟ場空調改善事業','給⾷費保護者負担軽減対策事業']:
 q=re.search(r'\s*'.join(re.escape(ch) for ch in name),t);assert q,name;row(c,t,name,q.group(),start=q.start())
for name,raw in [('美⾥町特産品PR事業','美⾥町特産品PR事 材撮影や販促コピーの作成を⾏うことで、実店舗に縛られ\n業'),('ペーパーレス会議システム導⼊事業','ペーパーレス会議 会議運営やテレワークの促進にもつながり、新型コロナウイ\nシステム導⼊事業'),('低所得の⼦育て世帯に対する⼦育て世帯⽣活支援特別給付⾦（町独自分）','低所得の⼦育て世\n帯に対する⼦育て\n31\n\n世帯⽣活支援特別\n給付⾦\n（町独自分）'),('原油価格高騰対策事業','原油価格高騰対策 価高騰の影響を受けた、町内の中小企業者・小規模企業者\n事業'),('原油・物価高騰化対策支援事業（指定管理者支援）','原油・物価高騰化\n39\n\n対策支援事業（指\n定管理者支援）')]:row(c,t,name,raw)
hold(c,t,'デジタル田園都市','Row32 financing portion explicitly identifies the same convenience-store/smartphone payment implementation as row18; no new business or summed costs.')
for name,raw in [('保育所・認定⼦ども園等特別対策支援事業','保育所・認定⼦ど\n46\n\n事業\n\n交付対象事業の名\n\nも園等特別対策支\n援事業'),('保育所等給⾷支援事業','保育所等給⾷支援\n事業'),('美⾥バス利⽤促進事業','美⾥バス利⽤促進 より、買い物などの外出を控える交通弱者に対し、移動に係\n事業')]:row(c,t,name,raw)
for raw,reason in [('原油価格高騰対策','Rows33/53 have identical project name for corporate/individual recipients; one project only, amounts not summed.'),('地域少⼦化対策重','Explicitly no annual implementation; no completed annual project inferred from grant label.'),('令和6年2⽉28⽇','Row50 cross-year and planned end; annual execution remains unresolved.'),('電気・ガス・⾷料','Row51 is funding-programme label with FY2022/FY2023 interval and missing spend; no independent annual business identity.'),('修学旅⾏支援事業','Rows41/42 same project split by purpose; no separate independent identifiers, keep components held.'),('地域自殺対策強化','Regional grant-programme label; standalone municipal business title absent.'),('妊娠出産⼦育て支','Grant-programme title versus constituent benefit identity unresolved.'),('フィルタリングソ','Row23 title fragments far apart in extracted order; exact complete-title boundary absent.')]:hold(c,t,raw,reason)
# Other early rows still require review; retain actionable marker until checked.
for name,raw in [('地域逸品商談支援事業','地域逸品商談支援 会を開催。それに伴い、商談会に慣れていない町内事業者を\n事業'),('観光スポット周遊キャンペーン事業','観光スポット周遊 町内各地域への周遊を促進し、滞在時間や観光消費の拡⼤を\nキャンペーン事業'),('新型コロナウイルス対策中小企業資⾦利⼦補給⾦','新型コロナウイル\n3\n\nス対策中小企業資\n⾦利⼦補給⾦'),('営業時間短縮に係る感染拡⼤防⽌協⼒⾦','営業時間短縮に係\n4\n\nる感染拡⼤防⽌協\n⼒⾦'),('避難所⽤備品購⼊事業','避難所⽤備品購⼊ う際に不特定多数の接触を避けるため、個々に分かれた充電\n事業'),('原油・物価高騰化対策支援事業（農業者及び法⼈支援）','原油・物価高騰化 ①新型コロナウイルス感染症の影響による、原油価格及び物\n38\n\n対策支援事業（農 価高騰の影響を受けた、町内の農業者及び農業法⼈等への経\n業者及び法⼈支\n\n済的支援を⾏う。\n\n援）')]:row(c,t,name,raw)
hold(c,t,'学校保健特別対策','Row43 national programme title and same school-consumables implementation as row21; independent local project identity unproved.')
hold(c,t,'応型契約管理シス','Row8 project-title beginning and ending are reversed and interleaved with narrative; exact printed order unavailable without coordinates. No guessed complete title.')
c['holds']=[h for h in c['holds'] if h.get('status')!='layout_review']
c=next(c for c in configs if c['sourceId']=='79b0ada6b7b9a42cac24f548');t=verified_text(c['sourceId'],'43348')
for name in ['トイレ改修事業','蛇口改修事業','キャッシュレス決済の導入','美里バス利用促進事業']:
 row(c,t,name)
for name,raw in [('新型コロナウイルス対策中小企業資金利子補給金','新型コロナウイルス対策 ②新型コロナウイルス感染症の影響により中小\n中小企業資金利子補給金'),('道の駅美里「佐俣の湯」換気型空調設置事業','道の駅美里「佐俣の湯」換 気が可能な空調設備を整備することにより、施\n気型空調設置事業'),('スクール・サポート・スタッフ派遣事業','スクール・サポート・スタッ\nル・サポート・スタッフを任用する。\nフ派遣事業'),('学校運営に伴う感染症対策に係る支援事業','学校運営に伴う感染症対 集まる場所や機会において、迅速かつ柔軟に対\n策に係る支援事業'),('美里出身学生生活サポート事業','美里出身学生生活サポー\nられる学生の生活支援を目的とする\n令和3年10月1日\nト事業'),('やすらぎ交流体験施設大部屋空調整備事業','やすらぎ交流体験施設大\nイルス等の感染症拡大防止につなげるため、２\n部屋空調整備事業'),('キャンプ場管理棟空調改善事業','キャンプ場管理棟空調改 により、施設利用者が安心して利用できる環境\n善事業'),('森林・山村多面的機能発揮対策事業','森林・山村多面的機能発 備活動に対し助成を行い、雇用の場の確保を図\n揮対策事業'),('ワクチン接種会場への移動支援事業','ワクチン接種会場への移\n行う。\n動支援事業'),('各種相談・申請支援窓口開設事業','各種相談・申請支援窓口\n相談、国県の支援策への相談）窓口を開設する\n開設事業'),('営業時間短縮に係る感染拡大防止協力金','営業時間短縮に係る感染 給に係る町内事業者分の負担金\n拡大防止協力金'),('やすらぎ交流体験施設トイレ洋式化事業','やすらぎ交流体験施設ト のため、蓋付き洋式トイレへ改修し、利用者の感\n令和3年10月13日\nイレ洋式化事業')]:row(c,t,name,raw)
hold(c,t,'修学旅行支援事業','Rows16/17 split same base project by transport/cancellation support; independent programme identity not proved, no double counting.')
for name in ['学習環境整備事業','ICT支援員委託事業','スクールバス委託事業','緊急雇用対策事業']:row(c,t,name)
for name,raw in [('GIGAスクール環境整備事業','GIGAスクール環境整備事\n徒への配布物等を同端末で行っているが、机の\n業'),('保育所等事業継続支援事業','保育所等事業継続支援事\n従事者への応援助成金\n業'),('フォレストアドベンチャー・美里整備事業','フォレストアドベンチャー・ 染防止対策をはかるために待機スペースの取\n美里整備事業'),('美里町中小企業者事業継続支援金','美里町中小企業者事業継 用・事業の維持を支援する。\n令和3年11月26日\n続支援金'),('フォレストアドベンチャー・美里改修事業','フォレストアドベンチャー・\nり、利用客及びスタッフも安心して利用できる環\n美里改修事業'),('オンライン申請対応型契約管理システム事業','オンライン申請対応型契\nにつながる。\n約管理システム事業'),('子育て世帯への臨時特別給付金事業','子育て世帯への臨時特別\n令和3年12月24日\nる。\n給付金事業'),('美里町中央庁舎空調設備改修事業','美里町中央庁舎空調設備\nする換気風量（30㎥/ｈ）を確保する仕様の設計\n改修事業')]:row(c,t,name,raw,note='令和3年度の個別実施名称。施設工事の設計のみを完成とせず、列混在の数値を転記しない。')
row(c,t,'図書館パワーアップ事業')
for name,raw in [('健（検）診結果等の様式の標準化整備事業（単独事業分）','健（検）診結果等の様式の 診断を推進するため、国による健（検）診結果の\n標準化整備事業（単独事 利活用に向けた情報標準化整備事業に伴い、\n業分）'),('健（検）診情報システム整備事業（単独事業分）','健（検）診情報システム整 診断を推進するため、国による健（検）診情報連\n備事業（単独事業分）')]:row(c,t,name,raw)
for raw,reason in [('疾病予防対策事業費等補','Rows42/46/47/50 describe national/municipal funding parts of same health-system changes, with reversed descriptions for the two screening systems; no extra project or costs inferred.'),('地域少子化対策重点推進','Funding programme label without independent local business title; beneficiary count is not a separate project.'),('学校保健特別対策事業費','National funding part repeats local school-infection implementation; no extra project.'),('令和4年7月26日','Row51 is construction portion of same central-building air-conditioning project, crossing FY2021/FY2022; prior row41 design retained without completion or construction cost.')]:hold(c,t,raw,reason)
# Only unreviewed title family from first page remains explicit below.
hold(c,t,'地域の基礎的活力養成事','Row6 generic programme title is interleaved with multi-language sign installation; independent budget identity not established from narrative title fragment.')
c['holds']=[h for h in c['holds'] if h.get('status')!='layout_review']
c=next(c for c in configs if c['sourceId']=='1b4f89554a93c02fa1743c86');t=verified_text(c['sourceId'],'43348')
for name in ['ICT教育環境整備事業','学校施設環境改善事業','庁舎内感染対策事業','緊急雇用対策事業']:row(c,t,name)
for name,raw in [('美里町中小企業者事業継続支援事業','美里町中小企業者事業継\n②国（持続化給付金）又は県（事業継続支援金）\n続支援事業'),('各種相談・申請支援窓口開設事業','各種相談・申請支援窓口\n開設することで雇用・事業の維持を支援する。\n開設事業'),('美里出身学生に地元の産品で生活サポート事業','美里出身学生に地元の産\nで学生の生活支援を行う。\n品で生活サポート事業'),('オンライン申請対応型契約管理システム導入','オンライン申請対応型契\n者、来庁者の接触機会が減り感染防止につなが 令和2年12月9日\n約管理システム導入'),('コロナウイルス感染症対応支援','コロナウイルス感染症対 行った町内事業所を支援する\n応支援'),('プレミアム付き商品券発行事業','プレミアム付き商品券発 県内住民に販売することで、町内事業所を応援\n令和2年8月19日\n行事業')]:row(c,t,name,raw)
for raw,reason in [('消費喚起事業','FY2020–FY2021 multi-year end; do not assign funding-year as sole execution year.'),('公立学校情報機器整備事','Cross-year FY2020–FY2021 and related ICT equipment row; annual identity/overlap unproved.'),('福祉避難所空調整備事業','Cross-year FY2020–FY2021; single annual execution not established.'),('地域の絆プロジェクト支援','Same programme split into environment/community components, independent identity unresolved.'),('学校保健特別対策事業','Repeated national programme and local infection-prevention implementation; preserve funding components without separate projects.')]:hold(c,t,raw,reason)
for name in ['テレワーク環境整備事業','中央公民館網戸整備事業']:row(c,t,name)
for name,raw in [('映像産業を軸とした観光・産業振興と地域ブランディング事業','映像産業を軸とした観光・ 作成し、各地域の魅力をPRする\n産業振興と地域ブランディ\nング事業'),('自主防災組織避難所運営事業','自主防災組織避難所運営\n立を促すことにより災害の備えへの意識の高揚\n事業'),('体育施設大型扇風機整備事業','体育施設大型扇風機整備 時に館内の感染症防止のために大型扇風機を\n事業'),('屋外社会体育施設用自動手指消毒器設置事業','屋外社会体育施設用自動 手指消毒を設置するスペースがないため壁掛け\n令和2年12月22日\n手指消毒器設置事業'),('インフルエンザ予防接種費用助成事業','インフルエンザ予防接種\n②インフルエンザの予防接種に係る費用\n費用助成事業')]:row(c,t,name,raw)
for raw,reason in [('社会体育施設トイレ洋式','FY2020–FY2021 interval; annual execution allocation absent.'),('公園遊具設置事業','FY2020–FY2021 interval and detached date columns; annual attribution unproved.'),('庁内ネットワーク環境整備','FY2020–FY2021 interval; annual execution allocation absent.'),('図書館パワーアップ事業','Printed start May2021 conflicts with end March2021; do not repair source dates by guessing.'),('公共的空間安全・安心確','Repeated generic project labels for multiple facilities; business versus component identity unresolved.'),('子ども・子育て支援交付','National funding label versus local after-school child-care implementation, not a separate project identity.')]:hold(c,t,raw,reason)
for name in ['学校給食事業者応援事業','蛇口改修事業','リモート講演会実施事業','芸術鑑賞補助事業','観光地PR事業']:row(c,t,name)
for name,raw in [('思い出づくりタイムカプセル購入事業','思い出づくりタイムカプセ\n校の卒業生にタイムカプセル購入費を補助す\nル購入事業'),('飲食店等の感染防止対策事業','飲食店等の感染防止対策\n援する。\n事業'),('乳幼児検診・相談時感染対策事業','乳幼児検診・相談時感染\nための消耗品を購入する。\n対策事業'),('スクール・サポート・スタッフ派遣事業','スクール・サポート・スタッ ル・サポート・スタッフを新たに任用し雇用の確\nフ派遣事業'),('通いの場感染防止対策事業','通いの場感染防止対策事 防止対策の取組みに補助を行う。\n業'),('森林・山村多面的機能発揮対策事業','森林・山村多面的機能発 備活動に対し助成を行い、雇用の場の確保を図\nる。\n揮対策事業'),('タクシー事業者の感染防止対策支援','タクシー事業者の感染防 支援する\n②タクシー内にパーテーション設置費用、消毒\n止対策支援'),('コロナウイルス感染症対応雇用維持奨励金交付事業','コロナウイルス感染症対\n持を図る事業主の負担を軽減するとともに、雇\n応雇用維持奨励金交付事\n用維持の一層の推進を図る。\n業')]:row(c,t,name,raw)
for raw,reason in [('ワーケーション環境整備','Printed start February2020 crosses FY2019/FY2020; no annual assignment from funding-year label.'),('修学旅行支援事業','Rows61/62 same base project with cancellation/transport components; do not count twice.'),('地域環境整備事業（観光）','Tourism component versus same base environmental-maintenance project unresolved; no extra identity.'),('地域の基礎的活力養成事','Generic programme heading versus specific signage installation lacks separate budget identifier.'),('観光地混雑解消事業','Detached title/date column requires exact row linkage; do not attach adjacent project date by proximity.')]:hold(c,t,raw,reason)
# Keep remaining early-row provenance review actionable until the final reconciliation.
for name,raw in [('子育て世帯臨時特別給付事業（新型コロナ対策分町独自分）','子育て世帯臨時特別給付\nにより経済的負担を軽減し子育て環境の整備を\n事業（新型コロナ対策分\n図る。\n町独自分）'),('新型コロナウイルス対策中小企業資金利子補給金','新型コロナウイルス対策 ②新型コロナウイルス感染症の影響により中小\n中小企業資金利子補給金'),('東部地区買い物拠点化事業','東部地区買い物拠点化事\nナウイルスの感染拡大を懸念して買い物に出か\n業')]:row(c,t,name,raw)
row(c,t,'観光地混雑解消事業');c['rows'][-1]['yearProof']='令和2年4月23日'
c['holds']=[h for h in c['holds'] if h.get('status')!='layout_review' and 'Detached title/date' not in h['reason']]
# Koshi: distinguish actual single-business sheets from policy matrices and instructions.
ledger=json.loads((root/'data/evaluations/descending-offline/43/source-ledger.json').read_text())
for s in ledger:
 if s['municipalityCode']!='43216' or s['status']!='unsupported_layout':continue
 id=s['sourceId'];t=verified_text(id,'43216')
 if t.startswith('事務事業マネジメントシート'):
  proof=re.search(r'事務事業マネジメントシート\(令和\s*6年度実績と令和\s*7年度計画\)',t);assert proof,id
  m=re.search(r'^事務事業名 ([^\n]+)',t,re.M);assert m,id
  c,t=source(id,'43216',2024,proof.group());c['evaluationYear']=2025
  row(c,t,m[1],m.group(),start=m.start(),note='令和6年度実績と令和7年度計画を区別した個別事務事業シート。金額の空欄や複数年度列、未選択の評価選択肢を推測しない。')
 elif t.startswith('施策マネジメントシート'):
  c,t=source(id,'43216',None,t.splitlines()[0]);hold(c,t,t[:500],'Policy-level management sheet: policy KPI/result columns and shared implementation narratives do not constitute individual business-sheet rows. No policy totals assigned to projects; named implementation coverage remains separate from this policy triage.')
 else:
  c,t=source(id,'43216',None,t.splitlines()[0]);hold(c,t,t,'Instructions explaining how to read management sheets; no actual business title/year or performance record.')
# Minamata: each complete evaluation sheet, body titles (not contents-page aliases).
minamata=[
 ('3396692f56d73709c1a30b4d',2010,'２２',['小中学校再編成推進事業','小中学校耐震化推進事業','学校エコ改修と環境教育事業','日本一の読書のまちづくり','学力向上対策事業','いじめ、虐待、不登校児童生徒対策','環境教育（学校版環境ＩＳＯ）の推進','人権教育推進事業','文化会館自主文化事業','公民館自主事業','市民スポーツの推進とスポーツ振興計画策定']),
 ('8e8fbadc886f8bee00e099c6',2011,'２３',['小中学校耐震化推進事業','学校エコ改修と環境教育事業','学力向上対策事業','いじめ、虐待、不登校児童生徒対策の充実','環境教育（学校版環境ＩＳＯ）の推進','日本一の読書のまちづくり','人権教育推進事業','文化会館自主文化事業','公民館自主文化事業','市民スポーツの推進','第６６回熊本県民体育祭水俣市・葦北郡大会開催','給食センターでの食育推進・地産地消推進事業']),
 ('db9c71d2a27e44b522c02cfd',2012,'２４',['小中学校耐震化推進事業','学力向上対策事業','いじめ、虐待、不登校児童生徒対策の充実','環境教育（学校版環境ＩＳＯ）の推進','給食センターでの食育推進・地産地消推進事業','日本一の読書のまちづくり','人権教育推進事業','文化会館自主文化事業','公民館自主文化事業','市民スポーツの推進']),
 ('2654b8be5ef9e0936c1fbfd0',2013,'２５',['学力向上対策事業','いじめ、虐待、不登校児童対策（いじめ、虐待、不登校児童生徒対策の充実）','環境教育（学校版環境ＩＳＯ等）の推進','給食センターにおける食育・地産地消推進事業','人権教育推進事業','文化会館自主文化事業','日本一の読書のまちづくり','公民館自主事業','市民スポーツの推進']),
 ('0faf9f5cb7ffa0e6d121506e',2014,'２６',['小中学校施設耐震化推進事業（非構造部材）','学力向上対策事業','いじめ、虐待、不登校児童対策事業','環境教育（学校版環境ＩＳＯ等）の推進事業','小中学校におけるＩＣＴ化の推進事業','給食センターにおける食育・地産地消推進事業','人権教育推進事業','文化会館自主文化事業','日本一の読書のまちづくり事業','公民館自主事業','生涯スポーツ活動及び競技スポーツの推進事業'])]
for id,fy,digit,names in minamata:
 c,t=source(id,'43205',fy,f'（平成{digit}年度実績）');starts=[m.start() for m in re.finditer('重要政策実施状況評価表',t)];covered=set()
 for name in names:
  matches=[(a,t.find(name,a,a+400)) for a in starts if t.find(name,a,a+400)>=0];assert len(matches)==1,(id,name,matches)
  a,p=matches[0];b=next((v for v in starts if v>a),len(t));body=t[a:b];assert len(body)>1000 and ('評価' in body and ('実績' in body or '成果' in body)),(id,name)
  row(c,t,name,t[p:p+len(name)],start=p,note='本文の個別評価表の名称と表紙の実績年度を保持。目次の別表記は別事業にせず、実施期間・過年度経費・評価選択肢から数値を推測しない。');covered.add(a)
 for a in starts:
  if a not in covered:hold(c,t,t[a:a+300],'Remaining individual sheet title needs exact header mapping; not missing body or access denial.');c['holds'][-1]['status']='layout_review'
 if fy==2013:hold(c,t,'平成２５年１１月','Cover publication year equals the full execution fiscal year while body states current FY25; preserve explicit execution FY2013, do not invent later evaluation year.')
c=next(c for c in configs if c['sourceId']=='3396692f56d73709c1a30b4d');t=verified_text(c['sourceId'],'43205')
for name in ['給食センターにおける食育・地産地消推進事業','第66回熊本県民体育祭水俣市・葦北郡大会開催準備']:
 p=t.index(name,2000);row(c,t,name,start=p)
c['holds']=[]
c,t=source('8508d76439946c1d994d2ba3','43208',2024,'検証結果について（令和６年度）')
row(c,t,'にぎわい再創出事業','■にぎわい再創出事業');row(c,t,'ふるさと未来創造事業','■ふるさと未来創造事業')
hold(c,t,'山鹿市ふるさと','Shared parent title/cost and constituent activity names: do not add another parent record or allocate total cost/KPI among two verified business headings.')
c,t=source('90c6d9df1c4d30b0e4bb2c7e','43205',None,'地方創生に関する事業の効果検証について')
for name,raw,year in [('過疎地域におけるICTを活用した持続可能なまちづくり事業（移住促進）','過疎地域におけるICTを活用し\nた持続可能なまちづくり事業\n（移住促進）',2022),('「選ばれる水俣」推進事業（コンビニ交付）','「選ばれる水俣」推進事業\n（コンビニ交付）',2024),('道の駅みなまた再整備事業','道の駅みなまた再整備事業',2021)]:
 row(c,t,name,raw,note='明示された事業実施年度を保持。後年のKPI・寄附年度・交付金額を当年度決算にしない。');c['rows'][-1].update(year=year,yearProof=str(year)+'年度')
hold(c,t,'2023年度～2024年度','Donation-use projects have a two-year implementation period with cumulative/annual policy KPIs. Individual fiscal-year execution absent; no annual record split or donation-to-cost conversion.')
hold(c,t,'オンライン手続の導入による自治体と住民との接点の多様化・充実化','Contents entry without matching complete individual assessment in saved body; no record from contents only.')
hold(c,t,'くまもと農地ＧＩＳを活用した情報共有化事業','Contents entry and prefecture contribution without matching individual assessment in body; no municipality implementation inferred.')
for id,code,proof,reason in [('8eef778a98f2f494527b7c05','43204','荒尾市行政経営計画','Administrative reform action matrix and account-wide financial summaries; numbered actions are organisational policy measures, not independently identified budget businesses. No reform/KPI row converted into project.'),('9679d349671c811581382343','43202','施策評価シート（評価対象年度：令和6年度）','Policy KPI matrix with multiyear target/actual columns; no bounded individual business-sheet identities. Policy indicators must not become projects or be assigned to similarly named projects.')]:
 c,t=source(id,code,None,proof);hold(c,t,t[:500],reason)
c,t=source('bd1275bf2c4a4d124d4ac201','43202',2024,'「市民の皆様による行政評価」におけるご質問に対する回答')
raw='バドミントンアジアジュニアチャン\n円と約2.8倍に。 連盟を２回追加で訪問したためです。\nスポーツ振興課 ピオンシップ誘致事業'
row(c,t,'バドミントンアジアジュニアチャンピオンシップ誘致事業',raw,note='質問の金額を実績として採用しない。市の回答に令和6年6月・9月、令和7年1月の誘致活動を明記。既存の日本代表合宿事業とは別の明示名称。');c['rows'][-1]['yearProof']='３回目（令和７年１月）は、八代市を開催地とする基本合意'
master=next((root/'apps/web/public/evaluations-composed').glob('43202-*.json'));known={p['projectName'] for p in json.loads(master.read_text())['projects']}
lines=t.splitlines(keepends=True);offset=0
for i,line in enumerate(lines):
 if re.match(r'^(市長公室|総務企画部|市民環境部|健康福祉部|経済文化交流部|農林水産部|建設部|教育部)',line):
  raw=''.join(lines[i:i+3]).rstrip('\n');names=[n for n in known if n in raw]
  for name,parts in [('令和6年能登半島地震支援事業（職員派遣）',['令和6年能登半島地震支援事','業（職員派遣）']),('新八代駅周辺大規模集客施設等整備基本計画策定事業',['新八代駅周辺大規模集客施設等整備','基本計画策定事業']),('防災行政情報通信システム管理運営事業',['防災行政情報通信システム管理運営','事業']),('電力・ガス・食料品等価格高騰重点支援給付金給付事業（重点交付金）',['電力・ガス・食料品等価格高騰重点','支援給付金給付事業（重点交付金）']),('アウトドアツーリズム推進事業（地方創生）',['アウトドアツーリズム推進事業（地','方創生）']),('クルーズ船寄港に伴う観光資源強化事業',['クルーズ船寄港に伴う観光資源強化','事業'])]:
   if all(p in raw for p in parts):assert name in known;names.append(name)
  if 'バドミントンアジアジュニアチャン' in raw:reason='New explicitly titled annual inducement project handled above; question amounts not used.'
  elif names:reason='Existing master business reference(s): '+', '.join(sorted(set(names)))+'. Existing records/fields remain unchanged; question figures are not adopted as facts.'
  else:reason='Department/question block lacks an independently bounded business title; no inference from neighbouring row.'
  c['holds'].append(dict(start=len(t[:offset].encode('utf-16-le'))//2,raw=raw,reason=reason,status='reviewed_qa_reference'))
 offset+=len(line)
(root/'apps/crawler/src/evaluations/expansion/descending-kumamoto-map.ts').write_text('export const kumamotoRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print([(c['sourceId'],len(c['rows']),len(c['holds'])) for c in configs])
