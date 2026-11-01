import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[4]; docs=root/'apps/web/public/evaluation-evidence/documents';configs=[]
def source(id,code,year,proof):
 t=json.loads((docs/(id+'.json')).read_text())['text'];assert proof in t
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
(root/'apps/crawler/src/evaluations/expansion/descending-kumamoto-map.ts').write_text('export const kumamotoRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print([(c['sourceId'],len(c['rows']),len(c['holds'])) for c in configs])
