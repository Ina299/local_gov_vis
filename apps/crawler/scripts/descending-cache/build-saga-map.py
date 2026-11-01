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
 expected=next(r for r in json.loads((root/'data/evaluations/descending-offline/41/source-ledger.json').read_text()) if r['sourceId']==id)
 c=dict(sourceId=id,municipalityCode=code,year=year,proof=proof,fullTextSha256=hashlib.sha256(t.encode()).hexdigest(),rows=[],holds=[]);configs.append(c);return c,t
def row(c,t,name,raw=None,note='年度報告の明示された事業名のみ。金額・政策指標・親項目の評価は転記しない。',start=None):
 raw=raw or name;p=t.index(raw) if start is None else start;assert t[p:p+len(raw)]==raw
 c['rows'].append(dict(name=name,start=len(t[:p].encode('utf-16-le'))//2,raw=raw,note=note))
def hold(c,t,raw,reason):
 p=t.index(raw);c['holds'].append(dict(start=len(t[:p].encode('utf-16-le'))//2,raw=raw,reason=reason))
# Policy reports: do not convert reform/KPI activities into business records.
for id in ['f95948b5972371c492cc68f7','e2995fd1bf3105737fd4a65b','3d96084b325a0a9456ca4031']:
 t=verified_text(id,'41425');c,t=source(id,'41425',None,t[:100]);hold(c,t,t[:100],'Administrative reform action/KPI report. Staffing ratios, training, fund management and review counts do not establish independently identified annual business sheets. Need explicit business identity and individual fiscal-year boundary; no KPI converted.')
c,t=source('9b012828bd9679b6506d267b','41424',2019,'この報告書は、令和元年度事業に係る江北町教育委員会の点検・評価を実施')
hold(c,t,'● 主要な施策毎の点検結果及び評価','Policy-level education evaluations; review literal named individual programmes separately. Policy evaluations cannot be inherited by activities.');c['holds'][-1]['status']='layout_review'
c,t=source('0d7e4d7eeae35ad79595f62d','41424',None,'令和6年10月');c['evaluationYear']=2024
for name,raw in [('ストックマネジメント計画策定','ストックマネジメント計\n\n修繕・改築計画策定（ポンプ 江北町\n\n画策定'),('SM計画に基づく管路施設の点検・調査','SM計画に基づく管路施設\n\n管路施設の点検・調査'),('江北クリーンセンター機械・電気設備等更新','江北クリーンセンター機\n\n水処理施設、汚泥処理施設、 江北町\n\n理場\n\n械・電気設備等更新'),('東分・八町汚水中継ポンプ場機械・電気設備等更新','東分・八町汚水中継ポン\n\nポンプ設備、運転制御設備、 江北町\n\n場\n\nプ場機械・電気設備等更\n\n付帯設備等\n\nストマネ\n下水道\n\n一般\n\n江北町\n\n直接\n\n江北町\n\nA07‑004\n\n新'),('管路施設等更新','管路施設等更新')]:
 row(c,t,name,raw,note='A07-001〜005の別番号を持つ個別基幹事業。H30〜R4の複数年度で実施FYは空欄、事後評価実施時期R6年10月のみEY2024。計画全体及びKPIは追加せず、総額・予定額は未抽出。')
# Omachi: only rows with unambiguous dates within FY2022; cross-year/funding-only rows held.
c,t=source('54ea27c1aa0e6971b0e6e51e','41423',2022,'令和4年度新型コロナウイルス感染症対応地方創生臨時交付金効果検証')
for name,raw in [('大町町公共施設インターネット系LAN引込み工事','大町町公共施\n設インターネッ\nト系LAN引込み\n工事'),('大町ひじり学園ICT教育機器整備事業','大町ひじり学園\nと教職員の端末及び予備機を整備し、新型コロ\nICT教育機器 教育委員会事務局\nナウイルス感染症対策としてリモート学習や調\n整備事業'),('「大町町立保育園」の給食費等の負担軽減事業','「大町町立保\n育園」の給食\n費等の負担軽\n減事業'),('給食費物価高騰対策事業','給食費物価高\nている学校給食の給食費は据え置きし、保護\n教育委員会事務局\n騰対策事業'),('大町町インフルエンザ接種商品券配布事業','大町町インフ\nルエンザ接種\n商品券配布事\n業')]:
 row(c,t,name,raw,note='R4年度表のうち実施開始・終了がR4年4月〜R5年3月内の行を個別照合。費用・財源・効果数値は対応未確定のため入力しない。')
hold(c,t,'大町町農業資\n材等価格高騰\n11 対策事業','Row11 actually executes R5年4月〜10月; grant/report fiscal label is not FY2022 execution. Review with per-row FY2023 proof, not bulk year assignment.');c['holds'][-1]['status']='layout_review'
hold(c,t,'大町ささえあい','Remaining displaced rows and funding-period labels require individual date binding; no shared date-column inference.');c['holds'][-1]['status']='layout_review'
# Arita annual evaluation lists: reviewed literal full names only, no numeric columns.
arita_names='''議会研修事業|議会広報事業|議会放映委託事業|総務管理事業|例規・法制執務支援事業|職員研修事業|広報公聴事業|交通安全対策事業|交通指導員事業|区長事業|区行政委託事業|防犯事業|ふるさと納税推進事業|防災諸費事業|防災行政無線管理事業|防災備蓄品事業|伊万里・有田消防組合事業|非常備消防事業|積載車整備事業|土地建物賃借事業|大有田焼会館管理事業|公用車管理事業|情報一般管理事業|総合行政ネットワーク事業|基幹業務システム管理事業|会計管理事業|コミュニティバス等運行事業|松浦鉄道対策事業|企業誘致対策事業|定住促進事業|男女共同参画推進事業|合併振興基金事業|お試し住宅管理・運営事業|結婚新生活支援事業|有田町アスリート等交流実証事業|消費者行政推進事業|東出張所管理事業|戸籍住民基本台帳事業|証明書コンビニ交付サービス事業|環境衛生総務事業|伊万里・有田地区衛生組合事業|佐賀県西部広域環境組合事業|リサイクルプラザ運営事業|リサイクルプラザ修繕事業|クリーンパーク運営事業|賦課徴収事業|公共下水道公営企業費|農業集落排水事業公営企業費|浄化槽整備推進事業公営企業費|クリーンパーク等修繕事業|社会福祉協議会支援事業|権利擁護支援事業|老人福祉センター事業|シルバー人材センター支援事業|敬老祝事業|老人クラブ事業|高齢者の生活支援一般事業|介護予防・生きがい活動支援事業|健康づくり介護予防ポイント事業|生活管理指導短期宿泊事業|地域生活支援事業|重度心身障害者医療費助成事業|障害福祉サービス事業|老人施設入所費|国民健康保険事業|介護保険事業|後期高齢者医療事業|伊万里看護学校運営支援事業|不妊治療支援事業|母子健康診査事業|母子相談指導事業|母子保健教室事業|健康診査事業|感染症対策事業|有田町誘客イベント開催支援事業|中小企業等応援金事業|飲食店を通じた地域活性化事業|労働者福祉事業|有田国際陶磁展実施事業|商工振興団体支援事業|振興資金貸付事業|国際交流員招致事業|地域商業活性化支援事業|クリエイティブ・レジデンシー事業|お祭り振興会補助事業|有田陶器市事業|有田館事業|小路庵事業|観光協会事業|観光振興事業|体験工房「ろくろ座」事業|肥前窯業圏活性化推進事業|地域おこし企業人受入事業|訪日外国人受入環境整備事業|活力ある結いの里づくり推進事業|有害鳥獣対策事業|中山間地域等直接支払制度事業|多面的機能支払交付金事業|国見土地改良区事業|国見湖畔公園管理事業|腰岳健康の森公園管理事業|森林環境保全直接支援事業|竜門施設管理事業|自然公園維持管理事業|アジア文化交流プラザ施設管理事業|林道管理事業|道路橋梁維持事業|道路橋梁新設改良事業|公園管理事業|住宅管理事業|宅地耐震化推進事業|定住促進住宅管理事業|有田町ブロック塀耐震補助事業|教育研究事業|外国青年招致事業|学校適応指導教室事業|不登校傾向生徒支援事業|小中学校ＩＣＴ機器活用事業|Ｑ－Ｕアンケート実施事業|放課後等補充学習支援事業|外国語指導助手事業|小学校プログラミング研究事業|小学校研究等事業|中学校研究等事業|有田小学校給食事業|有田中部小学校給食事業|曲川小学校給食事業|大山小学校給食事業|大山小学校屋内運動場改修事業|有田中学校給食事業|西有田中学校給食事業|婦人の家運営事業|生涯学習センター管理・運営事業|子ども教室事業|通学合宿事業|公民館維持管理事業|公民館活動支援事業|図書館事業|歴史と文化の森公園管理事業|町民スポーツ大会事業|スポーツ協会事業|体育施設総務管理事業|赤坂球場施設管理事業|泉山体育館施設管理事業|体育センター施設管理事業|中央運動公園施設管理事業|有田陶磁美術館事業|埋蔵文化財保護事業|町並み整備促進事業|伝統的建造物群保存修理事業|旧田代家西洋館事業|私立保育園支援事業|障害児保育促進事業|町外公立保育所委託事業|施設型給付費等事業|放課後児童クラブ事業|子どもの医療費助成事業|障害児福祉サービス事業|放課後児童健全育成事業|保育施設緊急環境整備事業|子ども家庭総合支援拠点運営事業|巡回支援専門員整備事業|発達障害児及び家族等支援事業|ひとり親家庭等医療費助成事業|くわこば保育園事業|おおやま保育園事業'''.split('|')
sep=r'(?:\s|総務課|消防署|財政課|会計課|まちづく|り課|住民環|境課|上下水|道課|健康福|祉課|商工観|光課|農林課|建設課|学校教|育課|生涯学|習課|文化財|課|子育て|支援課)*'
for id,ey,fy,proof in [('dfc416e74c57541452e06bbf',2022,2021,'R４事務事業評価一覧'),('dc1b2c355950cd1c0d39d83d',2020,2019,'R２事務事業評価一覧')]:
 c,t=source(id,'41401',fy,proof);c['evaluationYear']=ey
 for name in arita_names:
  ms=list(re.finditer(r'(?<![ぁ-んァ-ン一-龠])'+sep.join(map(re.escape,name)),t))
  if not ms:continue
  assert len(ms)==1,(id,name)
  m=ms[0];row(c,t,name,m[0],start=m.start(),note='明示された年次評価一覧の個別事務事業名。R4評価のR3事業費欄／R2評価のR元事業費欄を対象年度根拠とし、評価年度と区別。担当課の挿入だけを除外し、数値列・評価結果は入力しない。')
 hold(c,t,proof,'Remaining displaced/wrapped names require review against numbered title columns; no generic suffix fragments or departments counted.');c['holds'][-1]['status']='layout_review'
for id,fy,proof in [('e63236dfc24d8e45d01637aa',2022,'令和４年度'),('df8f418e2eca173430e6ab79',2023,'令和5年度'),('2e499c42bec5b3c4c4424a1b',2024,'令和6年度')]:
 c,t=source(id,'41387',fy,proof)
 if fy==2022:
  row(c,t,'配合飼料価格高騰対策事業費補助金','②配合飼料価格高騰対策事業費補助金',note='名称の前後が離れているため経費欄の完全名称も照合。R4.6.21〜R5.3.31の実施期間、FY2022。金額は未入力。')
  a=t.index('応援券発行事業');b=t.index('玄海町みんなで')+len('玄海町みんなで');row(c,t,'玄海町みんなで応援券発行事業',t[a:b],start=a,note='分離した名称片を同一2番行内で照合。R4.8.2〜R5.3.24、FY2022。年度別実施として保持し財源内訳を別事業にしない。')
 elif fy==2023:
  a=t.index('応援券発行事業');b=t.index('玄海町みんなで')+len('玄海町みんなで');row(c,t,'玄海町みんなで応援券発行事業',t[a:b],start=a,note='同一1番行の分離名称、R5.9.20〜R6.3.25、FY2023。重点交付金分は財源内訳で別事業ではない。')
  row(c,t,'福祉サービス等物価高騰対策支援金事業','福祉サービス等\n2\n\n物価高騰対策支\n援金事業',note='2番行のR5.10.5〜R5.12.25を実施年度根拠とする。施設区分は内訳で追加事業にしない。')
  hold(c,t,'事業【低所得者','Displaced benefit title must be bound to its complete name; do not infer from neighbouring annual tables.');c['holds'][-1]['status']='layout_review'
 else:
  raw='低所得者支援及\nび定額減税補足\n2\n\n給付金事業【物\n価高騰対策給付\n\nを維持する。\n福祉・介護課／住\n民課\n\n金】'
  row(c,t,'低所得者支援及び定額減税補足給付金事業【物価高騰対策給付金】',raw,note='R6.8.5〜R7.3.30の実施行のみFY2024。複数の受給世帯区分・事務費は内訳として除外。')
  row(c,t,'配合飼料価格高騰対策事業（緊急対策）','配合飼料価格高\n11\n\n騰対策事業（緊\n急対策）',note='R6.7.24〜R6.10.7の実施行、FY2024。総額と交付金充当額・積算根拠の対応を推測しない。')
  hold(c,t,'R6.1.22','Row1 R6.1.22–R6.4.25 crosses FY2023/2024; funding-year heading not single-year execution evidence.')
  hold(c,t,'R7.3.5','Row7 R7.3.5–R7.4.7 crosses FY2024/2025; cannot assign entire row to report FY2024.')
c=next(c for c in configs if c['sourceId']=='df8f418e2eca173430e6ab79');t=verified_text(c['sourceId'],'41387');c['holds']=[]
row(c,t,'住民税非課税等臨時特別給付金事業【低所得者世帯給付金】','住民税非課税等\n3\n\n臨時特別給付金\n事業【低所得者\n世帯給付金】',note='3番行、R5.6.29〜R6.2.5の実施期間。FY2023。対象数・給付率・総額は一致を推測せず未入力。')
# Keep full bounded grant sheets as evidence for the per-row periods, not structured amounts.
for c in configs:
 if c['municipalityCode'] in ['41387','41423']:
  t=verified_text(c['sourceId'],c['municipalityCode'])
  for r in c['rows']:r.update(context=t,contextStart=0)
 if c['municipalityCode']=='41401':
  yp='Ｒ３事業費\n（千円）' if c['year']==2021 else 'Ｒ元事業\n費\n（千円）'
  assert yp in verified_text(c['sourceId'],'41401')
  for r in c['rows']:r['yearProof']=yp
# Kamimine has explicit annual link attribution in saved official HTML.
pageId='9cc64b8bd3a09701aa7009fa';page=verified_text(pageId,'41345')
for id,fy,pp in [('b1bd0dfdc1e90c0e967605c9',2018,'平成30年度地方創生推進交付金事業効果検証（PDF：111.1キロバイト）'),('3a1d2a25666c63a247f7832d',2019,'平成31(令和元)年度地方創生推進交付金事業効果検証（PDF：113.9キロバイト）'),('4f10f26313ab3ed6120c5e63',2020,'令和2年度地方創生推進交付金事業効果検証（PDF：132.9キロバイト）')]:
 c,t=source(id,'41345',fy,'地方創生推進交付金');assert pp in page;c.update(pageId=pageId,pageHash=hashlib.sha256(page.encode()).hexdigest(),pageProof=pp)
 name='DMO推進による稼ぐ観光商品づくりと地域の魅力向上・発信'
 a=t.index('DMO推進による稼ぐ');b=t.index('の魅力向上・発信',a)+len('の魅力向上・発信')
 row(c,t,name,t[a:b],start=a,note='保存済み公式掲載ページの年度別リンクと本文の1番事業名を照合。KPI、産品開発・観光設備等の構成活動は別事業にしない。金額は未入力。')
c,t=source('d06e8705e5d80c7d986efcf4','41345',2016,'平成27年度（平成28年度実施）地方創生加速化交付金')
row(c,t,'ビッグデータ分析に基づく上峰の「儲かる農業」の育成（儲かる農業育成事業）','ビッグデータ分析に基づく上峰の\n「儲かる農業」の育成（儲かる農業\n育成事業）',note='明示実施年度H28をFY2016とし交付年度H27と区別。講座・研修・産直ブースは構成活動、別事業にしない。')
for id in ['99b7e3dbf186487f46f426c8','365bec17329e0889664505ef','88f5d66a38cd91e7bba3c171']:
 c,t=source(id,'41345',None,'企業版ふるさと納税');hold(c,t,'企業版ふるさと納税','Corporate hometown-tax evaluation covers the overall regional revitalisation plan, broad policy themes and KPIs; no independently identified annual business sheets. Need explicit individual business boundary before adding records.')
c,t=source('cae48a2694edb7818abafc90','41345',None,'総合戦略');hold(c,t,'総合戦略','Multi-year general strategy, policy goals and KPIs. Not evidence for independent executed business records. No goals or prospective budgets converted.')
c,t=source('d892ba749feb0b713a241b41','41345',None,'事業効果検証シート（一覧）');hold(c,t,'国際感覚を身に付けさせる児童育成','Individual named projects exist but explicit fiscal-year/evaluation-year attribution unresolved. H28.3 is a KPI target date, not an execution year; saved page describes work before October2015 without a unique annual period. Preserve names without inventing year.')
for id in ['7a2d1ef49033623fc5abba83','e8369197e45bc6fa044ed031','0a2a9ec84f101c64ce7f81b3','cb1965f299944bd14617d895','382c4c82655d6c9f4a930f6f','078db3548dbe10a6c07dc986','4a59693972e9a39cec40e6b7','06f606f9eeca387e98a92bb8','c5218899d0892139a93610d9']:
 t=verified_text(id,'41327');assert '農業委員会' in t and '集積' in t and '遊休' in t
 c,t=source(id,'41327',None,t[:100]);hold(c,t,t[:100],'Agricultural committee statutory activity/target report: land aggregation, idle farmland, entrants, committee staffing and activity days. These are policy/activity indicators without separate budget-business identities; do not create project per KPI or turn prospective targets into actuals.')
for id,ey,count in [('9f994c6d3b45b93c14ee8f5c',2025,20),('16037c304765b195e071a447',2024,27),('4322eb8de66c94c467d46b99',2023,48)]:
 t=verified_text(id,'41401');proof=t.splitlines()[2];c,t=source(id,'41401',None,proof);c['evaluationYear']=ey
 body=t[t.index('■ 見直しに向けて検討する事業'):];names=[]
 for l in body.splitlines():
  l=l.strip()
  if not l or re.fullmatch(r'[0-9 ]+|中期|短期|長期|拡大|事務改善|民営化|民間活用|縮小|廃止|事業名|時期|事業数',l) or l.startswith(('■','今後の方向性')):continue
  names.extend(x.strip().replace('はり〈区切保持〉きゅう','はり、きゅう') for x in l.replace('はり、きゅう','はり〈区切保持〉きゅう').split('、') if x.strip())
 if ey==2023:
  k=names.index('給付事業');names[k-1]+=names.pop(k)
 assert len(names)==count,(id,len(names),names)
 for name in names:
  m=re.search(r'\s*'.join(map(re.escape,name)),t);assert m,name
  row(c,t,name,m[0],start=m.start(),note='見直し検討対象として明記された事業名のみ。評価年度と将来の見直し時期を区別し、実施FYは推測しない。集計件数・廃止予定を実績又は別事業に変換しない。')
for id,ey in [('b1ecde5048b58badbe461578',2022),('e7d53b18394cea02df8a935e',2020)]:
 t=verified_text(id,'41401');proof=t.splitlines()[2];c,t=source(id,'41401',None,proof);c['evaluationYear']=ey
 body=t[t.index('■ 見直しに向けて検討する事業'):].replace('外国青年招致事業・スマート','外国青年招致事業、スマート').replace('情報一般管理事業・総合','情報一般管理事業、総合').replace('・基幹業務システム','基幹業務システム').replace('社会資本整備総合交付金事業\n（効果促進','社会資本整備総合交付金事業（効果促進')
 names=[]
 for l in body.splitlines():
  l=l.strip()
  if not l or re.fullmatch(r'[0-9 ]+|中期|短期|長期|拡大|事務改善|民営化|民間活用|縮小|廃止|事業名|時期|事業数|資料１',l) or l.startswith(('■','今後の方向性')):continue
  names.extend(x.strip() for x in l.split('、') if x.strip())
 assert len(names)==(64 if ey==2022 else 70),(id,len(names))
 for name in names:
  m=re.search(r'\s*'.join(map(re.escape,name)),t);assert m,name
  row(c,t,name,m[0],start=m.start(),note='総点検の見直し検討対象名称。EYのみ、FY不明。詳細一覧と同名は重複除外し、表記違いは独立事業を意味しない。廃止・縮小は将来方向で実施実績を推測しない。')
# Explicit same-year alias/component holds from pairwise review (no fuzzy merge).
for c in configs:
 if c['sourceId']=='b1ecde5048b58badbe461578':
  reject={'中小企業等応援事業','地産地消推進事業','農業基盤整備促進事業'}
 elif c['sourceId']=='e7d53b18394cea02df8a935e':
  reject={'社会資本整備総合交付金事業（効果促進事業 泉山２５号線）','地産地消推進事業'}
 else:continue
 for r in c['rows']:
  if r['name'] in reject:c['holds'].append(dict(start=r['start'],raw=r['raw'],reason='Summary alias or funding component of a more specifically named detailed-list business: independent annual identity not established. Retain exact alternative wording; do not create a second business or overwrite the detailed name.'))
 c['rows']=[r for r in c['rows'] if r['name'] not in reject]
# Kiyama lists are summaries of the five already represented detailed books.
# Separate the publication/evaluation label from the detailed sheet's FY.
for id,book,matched,total in [('e3edeafbbb6f220dfa9296e7','0754f5756ae5df1e640fdc26',33,34),('fa250308d7db3cddfbfef822','0c2dea4458851dc4c64d0d10',93,94),('72f292f674c60f8f80911198','e7f635f44f7fa1dc5528677c',73,73),('99627a76d6b40da05f4a2021','1b118f8508d9366249d2623f',56,56),('28510b462a5c6599c2bf3b79','1d43ccf245d7aea7e330b2a4',48,48)]:
 t=verified_text(id,'41341');c,t=source(id,'41341',None,t[:100]);c['reviewStatus']='duplicate_summary'
 hold(c,t,t[:100],f'{matched}/{total} detailed-book names match literally after whitespace normalisation; source book {book} is already represented. Remaining R7 housing-title alias and R6 split-row131 are explicitly checked below. Summary publication year is one later than printed sheet FY, not a new year of execution. No new projects or edits to existing records.');c['holds'][-1]['status']='duplicate'
 if id=='e3edeafbbb6f220dfa9296e7':hold(c,t,'住宅リフォーム助成制度','Printed row14 is summary alias for existing 住宅リフォーム助成事業 in the corresponding book. Preserve existing name; no extra project.');c['holds'][-1]['status']='duplicate'
 if id=='fa250308d7db3cddfbfef822':hold(c,t,'防災重点農業用ため池の劣化状況評価、地\n131\n震・豪雨体制評価事業','Printed row131 matches existing full title with embedded row number removed. No new record, existing spelling preserved.');c['holds'][-1]['status']='duplicate'
for id in ['9741ebe2acddb3ed9f7db452','e96aa28417638ca8c223e797','fd217cc2d87f4f73c03f4144','29dbd1f775ddf9e8c535dcec','c384ac313a36437942f22207']:
 t=verified_text(id,'41341');c,t=source(id,'41341',None,t[:100]);hold(c,t,t[:100],'Evaluation methodology and aggregate direction counts accompanying the detailed business sheets; no distinct individual project from PDCA definitions or aggregate totals. See paired lists/books already covered.');c['holds'][-1]['status']='duplicate';c['reviewStatus']='duplicate_summary'

# Ureshino: full 286773-character book, including both continuations.
c,t=source('7adcf758c3dc92c420f03aa6','41209',2023,'令 和 5 年 度\n主 要 な 施 策 の 成 果 説 明 書')
headers=list(re.finditer(r'令和\s*5\s*年度\s*主要な施策の成果説明書',t));assert len(headers)==264
for n,h in enumerate(headers):
 end=headers[n+1].start() if n+1<len(headers) else len(t);b=t[h.start():end]
 assert '今年度行った事業での効果' in b,(n,'incomplete sheet')
 m=re.search(r'事業名 ([^\n]+)',b);assert m,(n,'missing business title')
 name=m[1];raw=m[0];start=h.start()+m.start()
 name=re.sub(r'\s*(?:【(?:現年|明許|継続費)】|[（(](?:R4)?(?:事故)?繰越(?:明許費)?[）)]| 明許)$','',name)
 if name in ['国民健康保険被保険者数','国民健康保険税','佐賀県国民健康保険給付費等交付金','戸籍住民基本台帳手数料']:
  hold(c,t,raw,'Statistical or revenue/funding account sheet; not evidence for a distinct expenditure/business identity. No headcounts, taxes or incoming grants converted to projects.');continue
 if name in ['KIZUKI・看板改修支援事業(観光看板修繕)','電力・ガス・食料品等価格高騰重点支援給付金支援事業（追加分）']:
  hold(c,t,raw,'Named component/additional tranche of same-year parent programme in this book. Independent business identity unresolved; keep component evidence but no additional project.');continue
 row(c,t,name,raw,start=start,note='令和5年度決算成果説明書の独立シートの先頭事業名。明許・現年・継続費・同名の学校別再掲は別事業に数えず、原表記は引用保存。国保統計・収入財源・親事業内の事業名欄は除外。金額・評価・数値は未抽出。')
 c['rows'][-1].update(context=b[:max(m.end(),min(500,len(b)))],contextStart=len(t[:h.start()].encode('utf-16-le'))//2)
hold(c,t,'事業名：','Nested component breakdowns (firefighter pay, nursery grants and festival activities) are not separate annual sheets; top-level title only. Duplicate generic names across elementary/junior schools and carryover/regular funding are conservatively one identity, no school/cost association inferred.')

for id in ['e9d217f24606b6a1df9d186b','eb7f2a600591e5a428c165f7','367fec78fa599866486496e7']:
 t=verified_text(id,'41210');c,t=source(id,'41210',None,t[:100]);hold(c,t,t[:100],'Multi-year sewer/septic regional plan evaluation (R2–R4 or H27–R1). Individual implementation names exist, but values are cumulative and no explicit assessment date or annual execution row identifies a single fiscal year. KPI baseline/midpoint/end years are not the evaluation date. Require explicit evaluation-year evidence or an annual implementation sheet; do not infer year from period end or duplicate the same plan at mid/final review.')

for id,fy,names in [('2c5dd9c7a0699883e2130195',2025,['自主防災組織活動事業費補助金','高校入学等準備支援金事業','妊婦支援給付金事業','省エネ家電買替補助金','たけおまちづくりポイント事業','みどり地区トレーニングファーム事業','武雄市新文化交流施設エリア整備']),('200332e6abae1ff4c5fcb0b3',2024,['宿泊施設等整備奨励制度','宿泊施設魅力向上支援事業補助金','みどり地区トレーニングファーム事業','武雄市新文化交流施設エリア整備']),('4a0cdf711fe9ed9dab211228',2023,['高校生のまちづくり参画事業','宿泊施設等整備奨励制度','宿泊施設魅力向上支援事業補助金','みどり地区トレーニングファーム事業','武雄市新文化交流施設エリア整備'])]:
 t=verified_text(id,'41206');c,t=source(id,'41206',fy,t.splitlines()[0])
 for name in names:
  m=re.search(r'\s*'.join(map(re.escape,name)),t);assert m,name
  row(c,t,name,m[0],start=m.start(),note='年度成果報告で実施を明記した固有名の事業・給付制度のみ。改革方針、組織改編、アプリ機能、財源収入やKPIを事業化しない。建設の開館予定年を実施年度にせず、当年実施部分のみ。金額・数値・全体評価は未入力。')
  r=c['rows'][-1];a=m.start();st=t.rfind('◆',0,a);en=t.find('◆',a);st=max(0,st);en=en if en>=0 else len(t);r.update(context=t[st:en],contextStart=len(t[:st].encode('utf-16-le'))//2)
 hold(c,t,t[:100],'Policy reform headings, staffing and revenue indicators, online-service features, unnamed commissioned work and broad public-enterprise accounts are not independently identified business sheets. Only explicitly named current-year individual programmes above retained; no policy score or aggregate amount assigned.')

c,t=source('990115f436c9c58920adbc68','41205',2018,'平成３０年度における主要な施策の成果を提出します。')
spec=json.loads((root/'apps/crawler/scripts/descending-cache/imari-reviewed-titles.json').read_text());assert spec['fullTextSha256']==hashlib.sha256(t.encode()).hexdigest();assert spec['sheets']==295
for r in spec['rows']:
 assert t.encode('utf-16-le')[r['start']*2:(r['start']+len(r['raw'].encode('utf-16-le'))//2)*2].decode('utf-16-le')==r['raw']
 c['rows'].append({k:r[k] for k in ['name','start','raw','note']})
hold(c,t,'【主要な事務事業の概要・成果】','295 individual sheets reviewed; shared fiscal-year title variants (single/subsidy, carryover, financing components) deduplicate as one name. Two civic facilities with separate printed business numbers remain distinct. Policy labels and internal achievement/activity rows are not additional projects; no monetary-column inference.')

for id in ['1bb0a9ef99de1d6c48f0b453','3cd0df368b46cb251171e8c4','7f9b85890e3887e7df283920','89c72bbf84b55e6248b91237','8c2ce69a7347297b8f34250a','8c69468a757dd173a55e54cb','e14b73c6ad097df888d2d4f7']:
 t=verified_text(id,'41202');c,t=source(id,'41202',None,t[:100]);hold(c,t,t[:100],'Policy/unit-policy evaluation or blank template. Row codes are explicitly policy codes; indicators span multiple administrative programmes and blank result cells do not identify an independent annual business. Need actual named individual business sheets; no KPI-to-project conversion.')
for id,count in [('a0b40a9bc2c05800f6b33c66',8),('3eda5c1dfeea68567225b7e4',4)]:
 c,t=source(id,'41201',2025,'令和８年度');c['evaluationYear']=2026
 ms=list(re.finditer(r'事業名\s+(.+?)\s+担当課',t,re.S));assert len(ms)==count
 for n,m in enumerate(ms):
  name=m[1];end=ms[n+1].start() if n+1<len(ms) else len(t);b=t[m.start():end];assert 'Ｒ７年度' in b and '取組実績' in b
  if name=='事務管理経費':hold(c,t,m[0],'Generic administrative-cost label covers a child-policy plan/advisor package. Need independent project identity beyond generic account name; do not invent an expanded project title or split its activities.');continue
  row(c,t,name,m[0],start=m.start(),note='政策章内にある独立した「主な重点取組事業」欄のみ。R8評価とR7年度実績を区別し、政策全体のKPI・評価・将来目標は個別事業へ転記しない。決算と市費の数値列は未抽出。')
  c['rows'][-1].update(yearProof='Ｒ７年度',context=b,contextStart=len(t[:m.start()].encode('utf-16-le'))//2)
 hold(c,t,t[:100],'Opening policy chapters, goals and future target curves are not projects. Only the separately named current-year business sections are retained, without assigning policy-wide performance.')

c=next(c for c in configs if c['sourceId']=='9b012828bd9679b6506d267b');t=verified_text(c['sourceId'],'41424');c['holds']=[]
for name in ['別室における学校生活支援事業','スポーツ・文化育成費補助金制度']:
 row(c,t,name,note='FY2019教育点検報告に明示された固有名の制度のみ。ビッキールームの実施成果／大会参加への補助実績を確認。政策単位のA評価・人数等を当事業の数値として転記しない。')
 a=t.index(name);lo=max(0,a-250);hi=min(len(t),a+750);c['rows'][-1].update(context=t[lo:hi],contextStart=len(t[:lo].encode('utf-16-le'))//2)
hold(c,t,'道徳教育の抜本的改善・充実に係る支援事業','National/prefectural two-year research programme cited within municipal policy; a separately identified municipal annual business boundary is absent. Other curriculum/learning-policy activities lack independent budget-business identity. Do not inherit policy scores or create a business from every activity.')
c=next(c for c in configs if c['sourceId']=='54ea27c1aa0e6971b0e6e51e');t=verified_text(c['sourceId'],'41423');c['holds']=[]
items=[
 ('大町ひじり学園校内LAN更新工事','大町ひじり学園\nとり一台タブレットの使用には大容量通信に対\n校内LAN更新 教育委員会事務局 応できる環境が必要であり、また、GIGAスクー\n工事',2022),
 ('ひじり学園修学旅行コロナ対策事業','ひじり学園修学\nから徴収した費用との差額を補助する。\n旅行コロナ対 教育委員会事務局\nまた、6年生及び9年生の宿泊を伴う旅行で、新\n策事業',2022),
 ('大町町庁舎等感染対策事業','大町町庁舎等\n感染対策事業',2022),
 ('大町ささえあいプレミアム付商品券2022（令和3年度分）','大町ささえあい\nプレミアム付商\n品券2022（令\n和3年度分）',2022),
 ('”大町うまか券”配布事業','”大町うまか\n券”配布事業',2022),
 ('大町町農業資材等価格高騰対策事業（令和5年春作経営支援分）','大町町農業資\n材等価格高騰\n11 対策事業（令\n和5年春作経\n営支援分）',2023),
 ('大町町農業資材等価格高騰対策事業（令和4年秋肥料分）','大町町農業資\n材等価格高騰\n12 対策事業（令\n和4年秋肥料\n分）',2022),
 ('大町町水道料金減免事業','大町町水道料\n金減免事業',2022),
 ('新型コロナ・物価高騰対策子育て世帯生活支援金交付事業','新型コロナ・物\n価高騰対策子\n14 育て世帯生活\n支援金交付事\n業',2022),
 ('新型コロナ・物価高騰対策高齢者生活支援金交付事業(物価高騰対策分）','新型コロナ・物\n価高騰対策高\n齢者生活支援\n15\n金交付事業(物\n価高騰対策\n分）',2022)]
for name,raw,fy in items:
 row(c,t,name,raw,note='個別番号行の実施期間を確認。R4年度報告内の11番春作支援はR5年4〜10月実施なのでFY2023、他行はFY2022内。商品券のR3年度分は財源ラベルで実施FYと区別。金額の列は未入力。');c['rows'][-1].update(year=fy,context=t,contextStart=0)
 if fy==2023:c['rows'][-1]['yearProof']='令和5年4月\n\n令和5年10月'
assert len(c['rows'])==15

for spec in json.loads((root/'apps/crawler/scripts/descending-cache/arita-reviewed-titles.json').read_text()):
 c=next(c for c in configs if c['sourceId']==spec['sourceId']);t=verified_text(c['sourceId'],'41401');assert hashlib.sha256(t.encode()).hexdigest()==spec['fullTextSha256']
 for r in spec['rows']:
  assert t.encode('utf-16-le')[r['start']*2:r['start']*2+len(r['raw'].encode('utf-16-le'))].decode('utf-16-le')==r['raw']
  if any(x['name']==r['name'] for x in c['rows']):continue
  r['yearProof']='Ｒ３事業費\n（千円）' if c['year']==2021 else 'Ｒ元事業\n費\n（千円）';c['rows'].append(r)
for id,name,first,last in [
 ('dfc416e74c57541452e06bbf','地域おこし協力隊（サテライトオフィス運営）事業','地域おこし協力隊','33 （サテライトオフィス\n運営）事業'),
 ('dfc416e74c57541452e06bbf','社会資本整備総合交付金事業（南原原宿線道路改良事業）','129 付金事業（南原原宿線 建設課','社会資本整備総合交\n道路改良事業）'),
 ('dfc416e74c57541452e06bbf','（新型コロナ対応）スマートロック及び施設予約システム導入事業','予約システム導入事業 習課','175 マートロック及び施設'),
 ('dfc416e74c57541452e06bbf','ひとり親以外の低所得世帯生活支援特別給付金給付事業','ひとり親以外の低所得','196 世帯生活支援特別給\n付金給付事業'),
 ('dc1b2c355950cd1c0d39d83d','伊万里・有田地区医療福祉組合（病院事業会計）負担金','33 療福祉組合（病院事 財政課','伊万里・有田地区医\n業会計）負担金'),
 ('dc1b2c355950cd1c0d39d83d','社会資本整備総合交付金事業（南原原宿線道路改良事業）','131 交付金事業（南原原 建設課','社会資本整備総合\n宿線道路改良事業）')]:
 c=next(c for c in configs if c['sourceId']==id);t=verified_text(id,'41401');a=t.index(first);b=t.index(last,a)+len(last);row(c,t,name,t[a:b],start=a,note='同一表内の離れた名称片を印刷行番号33/129/175/196/33/131と完全名称で個別照合。別行の事業名・評価・金額を継承せず、引用全範囲を保存。');c['rows'][-1]['yearProof']='Ｒ３事業費\n（千円）' if c['year']==2021 else 'Ｒ元事業\n費\n（千円）'
# Preserve the full, specifically named detailed business where summaries use aliases.
for c in configs:
 if c['sourceId']=='b1ecde5048b58badbe461578':reject={'WEB有田陶器市販売促進支援給付金支給事業'}
 else:reject=set()
 for r in c['rows']:
  if r['name'] in reject:c['holds'].append(dict(start=r['start'],raw=r['raw'],reason='Case-only alias of detailed Web有田陶器市販売促進支援給付金支給事業; no independent project. Detailed source retains the identity.'))
 c['rows']=[r for r in c['rows'] if r['name'] not in reject]
 if c['sourceId'] in ['dfc416e74c57541452e06bbf','dc1b2c355950cd1c0d39d83d']:
  for h in c['holds']:
   if h.get('status')=='layout_review':h.update(status='identity_or_period_hold',reason='Reviewed all remaining title fragments, split numbered rows and department interleaving. Financial/evaluation columns remain unstructured because exact cell alignment and mixed score scales need original table coordinates. No additional independent named project remains in the reviewed cached title rows; duplicated and funding-component summary names are held separately. Coverage of source numerical fields is not complete.')

for id,names in [('b1ecde5048b58badbe461578',{'スマートロック及び施設予約システム導入事業'}),('e7d53b18394cea02df8a935e',{'有田町地域づくり事業'})]:
 c=next(c for c in configs if c['sourceId']==id)
 for r in c['rows']:
  if r['name'] in names:c['holds'].append(dict(start=r['start'],raw=r['raw'],reason='Summary shortened/alias wording overlaps the detailed same-year named programme (coronavirus smart-lock system or 新生まちづくり). Independent identity not proven; no extra record, detailed title preserved.'))
 c['rows']=[r for r in c['rows'] if r['name'] not in names]
# Kashima: explicitly reviewed independent business headers. Financial subrows stay out.
kashima=json.loads((Path(__file__).parent/'kashima-reviewed-titles.json').read_text())
c,t=source(kashima['sourceId'],'41207',2022,'令 和 ４ 年 度')
assert hashlib.sha256(t.encode()).hexdigest()==kashima['fullTextSha256']
for h in kashima['headers']:
 if h['status']=='reviewed_literal_business':
  row(c,t,h['name'],h['raw'],start=h['start'],note='R4決算書の明示事業名。内訳・財源区分・繰越区分を別事業にせず、既存記録と照合。金額・評価未抽出。')
  c['rows'][-1].update(context=h['context'],contextStart=len(t[:h['contextStart']].encode('utf-16-le'))//2)
 else:
  assert t[h['start']:h['start']+len(h['raw'])]==h['raw']
  c['holds'].append(dict(start=len(t[:h['start']].encode('utf-16-le'))//2,raw=h['raw'],reason=h['reason'],status='layout_review' if h['status']=='layout_review' else 'identity_or_period_hold'))
# Newer Arita lists: reviewed complete literal titles; preserve existing EY-only identities.
for reviewed in json.loads((Path(__file__).parent/'arita-newer-reviewed-titles.json').read_text()):
 id=reviewed['sourceId'];t=verified_text(id,'41401');c,t=source(id,'41401',None,t.splitlines()[1]);c['evaluationYear']=reviewed['evaluationYear']
 assert hashlib.sha256(t.encode()).hexdigest()==reviewed['fullTextSha256']
 for h in reviewed['rows']:
  row(c,t,h['name'],h['raw'],start=h['start'],note='年次評価一覧の完全な事業名のみ。既存の評価年度識別と照合し、年度・金額・評価欄を上書きしない。折返しや離れた名称は別途レビュー。')
 assert len(reviewed['rows'])==reviewed['expectedPrintedRows']-(1 if reviewed['evaluationYear']==2024 else 0)
 hold(c,t,t[:100],'All printed business titles reviewed including split/displaced rows. R6 one printed クリーンパーク運営事業事業 typo held against existing same-year canonical title; no extra identity. Financial and score columns require exact cell alignment and are not extracted.')
# Ogi progress tables: exactly 64 explicit budget-code/name lines in each saved annual report.
for id,fy in [('4046e04f86eac11d127f9f82',2024),('0e745b1131b7e4e2977f93ac',2023),('4b01748102703dc7e83c94cc',2022)]:
 t=verified_text(id,'41208');proof=t.splitlines()[0];c,t=source(id,'41208',fy,proof)
 matches=list(re.finditer(r'^(?:\d{2,4}|上水|下水)\s+([^\n]+)',t,re.M));assert len(matches)==64
 for m in matches:
  name=m[1].removesuffix(' 建設課');assert name.endswith(('事業','業務','事務')) or name=='社会資本整備総合交付金事業（新設改良）'
  a=m.start(1);row(c,t,name,name,start=a,note='明示予算番号を伴う事務事業名のみ。対象年度は進捗管理シートの年度であり、過年度完了事業を当年度実施・支出と主張しない。本文の実績と将来方向性が交錯するため金額・成果・完了年度は未構造化。既存同年度の事業名と重複照合。')
 hold(c,t,'実施計画進捗管理シート','All 64 budget-code/name lines reviewed. Mixed actual/future narrative columns and prior-year completion references are not attributed as current-year outcomes or costs; original coordinates required for those fields.')
for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-saga-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const sagaRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
