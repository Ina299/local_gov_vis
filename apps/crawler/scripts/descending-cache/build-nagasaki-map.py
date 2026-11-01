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
 expected=next(r for r in json.loads((root/'data/evaluations/descending-offline/42/source-ledger.json').read_text()) if r['sourceId']==id)
 assert hashlib.sha256(t.encode()).hexdigest()==expected['fullTextSha256'],id
 c=dict(sourceId=id,municipalityCode=code,year=year,proof=proof,fullTextSha256=hashlib.sha256(t.encode()).hexdigest(),rows=[],holds=[]);configs.append(c);return c,t
def row(c,t,name,raw=None,note='年度報告の明示された事業名のみ。金額・政策指標・親項目の評価は転記しない。',start=None):
 raw=raw or name;p=t.index(raw) if start is None else start;assert t[p:p+len(raw)]==raw
 c['rows'].append(dict(name=name,start=len(t[:p].encode('utf-16-le'))//2,raw=raw,note=note))
def hold(c,t,raw,reason):
 p=t.index(raw);c['holds'].append(dict(start=len(t[:p].encode('utf-16-le'))//2,raw=raw,reason=reason))
c,t=source('002367fb24b13646d6a3f7f6','42411',2024,'～令和 ６ 年度（２０２４ 年度）実施分～');c['evaluationYear']=2025
lines=list(re.finditer(r'^.*$',t,re.M));count=0
for n,lm in enumerate(lines):
 l=lm[0];prefix=re.match(r'^\d+ \d+ \d+ [①-⑳] ',l)
 if not prefix:continue
 count+=1;s=l[prefix.end():];s=re.sub(r'^(まち|しごと|ひと|横断) ','',s)
 m=re.fullmatch(r'(?:(.+?) )?((?:[\d,]+|[－ー−-])(?: (?:[\d,]+|[－ー−-])){4})(?: (.+))?',s)
 assert m,(l,'unexpected numeric table shape')
 name=m[1];raw=l;start=lm.start()
 if not name:
  name=lines[n-1][0]+lines[n+1][0];start=lines[n-1].start();raw=t[start:lines[n+1].end()]
  assert not re.match(r'^\d+ ',lines[n-1][0]) and not re.match(r'^\d+ ',lines[n+1][0])
 if not re.fullmatch(r'[\d,]+',m[2].split()[-1]):
  hold(c,t,raw,'R6決算 is a dash; historical completed/future/ongoing label does not prove FY2024 execution. No new annual record or amount inferred.');continue
 row(c,t,name,raw,start=start,note='明示された令和６年度実施分の個別事務事業行。R6決算が数字の行のみ。５年度分の金額・評価はこの段階で構造化せず、既存同名同年度と照合する。')
assert count==245
c,t=source('78e683f347949d3c67dd2dc6','42383',2023,'令和5年度 新型コロナウイルス感染症対応地方創生臨時交付金 事業実施状況及び効果検証')
for name,raw in [('低所得世帯支援給付金【低所得者世帯給付金】','低所得世帯支援給付金\n②1世帯当たり3万円\n【低所得者世帯給付金】'),('いま！おぢかでつかうけん','いま！おぢかでつかうけ\nた環境を整備する。\nん'),('農業用燃油高騰対策事業','農業用燃油高騰対策事\n福祉事務所\nる。\n業'),('漁業用燃油高騰対策事業','漁業用燃油高騰対策事 営を強いられている漁業者の生産活動を支援する。\n業')]:row(c,t,name,raw,note='FY2023 implementation table with explicit completed period. Source has inconsistent description/department in places; only printed business title, no description or amounts transferred.')
hold(c,t,'（事務費）','Administrative component of same low-income grant, not separate project.')
c,t=source('70ff71fff2b38c83a8b74755','42383',2023,'令和５年度物価高騰対応重点支援地方創生臨時交付金 事業実施状況及び効果検証')
row(c,t,'低所得世帯支援給付金（追加給付）事業','低所得世帯支援給付金\n②1世帯当たり追加交付7万円\n（追加給付）事業')
row(c,t,'低所得世帯支援給付金（均等割課税給付）事業','低所得世帯支援給付金 ②1世帯当たり交付10万円\n（均等割課税給付）事業')
for raw in ['農業用燃油高騰緊急対','漁業用燃油高騰緊急対']:hold(c,t,raw,'Same FY2023 beneficiary/fuel support and period as other funding table, different funding-window and name. Independent identity versus additional funding component unresolved; do not duplicate.')
c,t=source('06da362dcb5d1e47eb0cd5e9','42322',None,'（令和7年度事務事業評価対象事務事業）');c['evaluationYear']=2025
hold(c,t,t[:160],'Table mixes FY2024 continuing work with planned FY2026–2028 new projects; per-row fiscal year and forward-looking evaluation status require distinct handling. No execution year inferred from evaluation heading.')
c,t=source('4531526cc6cbb0e93b78f2c0','42321',2021,'令和3年度')
for name in ['地域振興券追加給付事業','飲食店緊急営業継続支援事業','介護予防事業等における感染症予防対策','水道料金減免による生活支援事業','学校給食費減免に係る支援給付金事業','東彼杵町農業経営収入保険制度支援対策事業','長崎県事業継続支援給付事業補助金','東彼杵町商工業者情報発信事業','令和３年度子育て世帯臨時特別支援事業費補助金','感染拡大防止検査キット整備事業','営業時間短縮要請協力金追加支援事業','営業時間短縮要請協力金事業（第4期）']:row(c,t,name)
hold(c,t,'事業所応援給付金（飲食店対象分）','Two beneficiary categories of 事業所応援給付金; independent annual business identity not proven. Keep categories out rather than count twice; monetary descriptions differ from actual totals, no cost transfer.')
hold(c,t,'事業所応援給付金（飲食店以外対象分）','Same parent programme as restaurant category; no separate budget-business identity established.')
c=next(c for c in configs if c['sourceId']=='06da362dcb5d1e47eb0cd5e9');t=verified_text(c['sourceId'],'42322');c['holds']=[]
names='''農業経営支援事業補助金（農業用ドローン導入）|学校給食センターおかず食缶更新|冷凍用・冷蔵用 両ユニット交換工事|石木小学校体育館暗幕改修事業|川棚中学校体育館トイレ洋式化事業|学校作業用車両更新事業|１人１台学習者用端末用ＰＣバック整備事業|小学校特別教室空調設置事業（７教室）|学校照明ＬＥＤ化改修事業|川棚中学校廊下及び階段床の防滑化整備事業|川棚中学校飲料用冷水器整備事業|展示ボード購入|講堂 会議用机購入|講習室 会議用椅子購入|中央公民館２階廊下空調改修工事|七浄寺跡と宝きょう印塔群における周辺整備|汚水マンホール漏水止水工事|公会堂行事等における舞台管理業務委託|教育キャンプ場除草作業業務|町道片島線舗装改修工事|町道小串新谷線改良工事（小串工区）|町道上組西部線歩道設置工事|町道中倉線改築工事|町道東臨港線歩道設置工事|町道馬場線改良工事、町道新谷三反間線改良工事|道路メンテナンス事業|県営事業（地方創生道整備推進交付金）建設負担金|排水路整備事業（基幹農道排水流末整備）|猪乗地区耕作道路整備事業|木場重地区渓流整備事業|川棚西部漁港三越地区片島桟橋Ａ・Ｂ改修事業|川棚西部漁港三越地区越波検討事業|公用車購入|才久ため池廃止工事|五反田圃場整備用水ポンプ補修事業|城山公園トイレ改築工事|川棚町都市公園リニューアル事業|川棚町公営住宅等長寿命化計画|川棚港緑地広場管理業務|野良猫苦情相談対応委託業務|所有者不明猫（野良猫）不妊・去勢手術費用助成事業|合併浄化槽設置整備事業補助金|庁内イントラネットワークシステム及び職員用ＰＣ更新|消防団 無線機購入|消防団 可搬ポンプ更新|乳児一般健康診査（１か月時）|公共下水道事業（下水道ストックマネジメント）|高校生等通学定期券購入補助|第６次総合計画後期基本計画策定|人口ビジョン策定業務支援|地域公共交通施策推進支援業務|大崎キャンプ場ログハウス解体撤去工事|東京日本橋長崎館における物産展開催|公民館２階トイレ改修工事に伴う設計・工事|第２期川棚町公共施設等総合管理計画策定業務|公共下水道事業（雨水管理総合計画策定）'''.split('|')
sep=r'(?:\s|農林水産課|教育委員会|建設課|住民福祉課|総務課|健康推進課|水道課|企画観光課|税財政課|○)*'
for name in names:
 m=re.search(sep.join(map(re.escape,name.replace(' ',''))),t);assert m,name
 row(c,t,name,m[0],start=m.start(),note='令和７年度評価対象の名称のみ。FY2024継続・FY2026〜2028予定が混在し行別実施年度は不明のためFYは空欄。却下・取下げを実施実績にせず、予算・決算・評価印は未抽出。')
for id,ey,proof,names in [
 ('3f8067ed5b6e9418cde2438a',2011,'事後評価実施時期\n\n平成23年度',['都市計画道路 西時津左底線（島本工区）','時津中央第２土地区画整理事業','まちづくり交付金事後評価作成業務委託','時津中央第２土地区画整理審議会']),
 ('6710cf359b1f8a08d1d5f39f',2017,'事後評価実施時期\n\n平成29年度',['左底横尾線道路整備事業','時津中央第２土地区画整理事業区域内下水道整備事業','町道吉田線道路改良事業','時津川放流排水路事業','都市再生整備計画事業効果調査'])]:
 c,t=source(id,'42308',None,proof);c['evaluationYear']=ey
 for name in names:row(c,t,name,note='都市再生整備計画の事後評価に明記された実施事業。複数年度期間のため単年度FYは不明、総額・地区KPIを配賦しない。')
 hold(c,t,'土地区画整理事業','District name, supplementary municipal funding and construction/compensation component are not distinct projects; no duplicates added. Single-year attribution absent.')
 if ey==2017:hold(c,t,'当初計画から 基幹事業 道路事業：長与時津線（西時津船津線）','Explicitly deleted projects and deleted council activities excluded, not completed work.')
for id,proof in [('bdf9f0c2aa660a595d50f729','計画の名称：時津南部地区都市再生整備計画'),('64654cddf8ce7ab8d35f204f','地区名：時津中央地区')]:
 c,t=source(id,'42308',None,proof);hold(c,t,proof,'Undated district-level pre-assessment checklist; no individual annual business sheet or explicit evaluation year. Do not turn each checklist criterion into a project.')
c,t=source('ba089cf1141fdef72df615a2','42308',None,'事後評価の実施時期\n令和５年２月');c['evaluationYear']=2022
row(c,t,'時津中央地区都市再生整備計画事業','時津中央地区都市再生整\n\n公園、区画整理等\n\n26.7ha\n\n■\n\n■\n\n■\n\n■\n\n2,141 1.22\n\n−\n\n備計画事業',note='個別番号A10‑001の事業。評価は令和５年２月（FY2022）、公開日FY2024ではない。H29〜R3複数年度事業のため単年度実施FYは空欄。構成公園/区画整理や地区KPIを別事業にしない。')
c,t=source('f9e98b69e8647559f76dbbe9','42214',None,'総合戦略');hold(c,t,t[:200],'Policy-wide goal/indicator inventory. No unique individual-business identity per KPI; no KPI-to-project conversion.')
c,t=source('0fa7043efdc460aee70032d8','42214',None,'地方創生交付金事業実績一覧');hold(c,t,t[:180],'Wide-table original of the explicitly reformatted per-project source eb42c0aaf5dac10bde3934f3. Use bounded complete sheets there; not a second set of projects.')
c,t=source('eb42c0aaf5dac10bde3934f3','42214',None,'1事業につき1枚に再構成')
blocks=list(re.finditer(r'地方創生交付金事業実績\nNo\.(\d+)[\s\S]*?(?=地方創生交付金事業実績|\Z)',t));assert len(blocks)==7
periods=[[2021,2022,2023,2024,2025],[2022,2023,2024,2025],[2022,2023,2024,2025],[2023,2024],[2025],[2025],[2021,2022,2023,2024,2025]]
for m,years in zip(blocks,periods):
 b=m[0];name=re.search(r'事業名\n\n[\s\S]*?\n([^\n]+)\n\n活用した交付金等',b)[1]
 for y in years:
  yp='令和'+str(y-2018)+'年度';idx=b.index(yp)
  row(c,t,name,yp,start=m.start()+idx,note='個別事業実績表の年度。再掲・財源別/部署別/繰越内訳を別事業にせず、同名同年度は一件。年度別実績と繰越予定を区別し、配置が不明な金額は未抽出。')
  c['rows'][-1].update(year=y,yearProof=yp,context=b,contextStart=len(t[:m.start()].encode('utf-16-le'))//2)
 hold(c,t,b[:100],'Only explicit annual execution retained. Empty annual rows, zero-only funding components, carryover-budget columns and subtotal sheets excluded from new business counts.')
c,t=source('7d86f47ce73248112a562698','42214',2025,'地方創生交付金事業実施調書（令和７年度事業）')
hold(c,t,'地方創生交付金事業実施調書（令和７年度事業）','Same six project identities/annual rows as the reformatted per-project table; no duplicate projects. Shared/interleaved KPI values need exact individual alignment before field enrichment, which is outside current no-existing-field-edit scope.')
goto_depts='こども未来課 地域協働課 奈留支所 学校教育課 岐宿支所 市民課 建設課 政策企画課 教育総務課 文化会館 文化観光課 水産課 生活環境課 社会福祉課 税務課 管理課 総務課 議会事務局 財政課 農林課 長寿介護課 三井楽支所 情報推進課 玉之浦支所 生涯学習課 観光物産課 富江支所 水道課 農林整備課 農業振興課 健康政策課 富江幼稚園 市長公室 福江幼稚園 商工振興課 観光交流課'.split()
generic={'管理業務委託料','運営業務委託料','運用保守業務委託料','運転管理業務委託料','コンサルティング業務委託料','収集等業務委託料','健診業務委託料','公園等管理','児童福祉施設費','外国人観光客受入体制整備','河川維持','バス利用者の環境整備玉之浦支所管内のバス停11箇所の維持管理'}
for id,ey,fy,proof in [('bf14284043f1216d18ae4d1d',2023,2022,'令和4年度に一般会計で実施した委託料'),('fdafa49cdd64eeb874dc4ed8',2021,None,'令和３年度\n\n事業評価一覧表'),('bf27718351b3efd1ba4a9126',2018,None,'平成３０年度\n\n事業評価一覧表'),('b909ef57d1d483e7bb1a960b',2016,None,'平成２８年度\n\n事業評価一覧表'),('e10e5f99515d7b20a94a49d3',2014,None,'平成２６年度\n\n事業評価一覧表'),('f4df0a926e3fcc88af7357bb',2013,None,'平成２５年度\n\n事業評価一覧表')]:
 c,t=source(id,'42211',fy,proof);c['evaluationYear']=ey;seen=set()
 for m in re.finditer(r'^('+'|'.join(goto_depts)+r')\n\n([^\n]+(?:\n[^\n]+){0,2})\n\n',t,re.M):
  raw=m[2];name=raw.replace('\n','')
  if len(name)>65 or not re.search(r'(事業|事務|費|負担金|補助金|助成金|委託料|整備|管理|業務|運営|対策|推進|支援|給付|建設|工事|健診|検診|保育|診査|調査|購入|教室|検査|設置|作成|受付|更新|指導|研修|維持|活動|教育|講座|保護)(?:[（(].+[）)])?$',name):continue
  if any(x in name for x in ['。','・・・','＜','目標','→','現状維持','H2','H3','R2','（ P.','（P.']) or name in goto_depts:continue
  if name in generic:
   hold(c,t,m[0],'Generic commission/account/category or interleaved narrative is not a complete unique business title. Needs explicit title-to-column association; not an access denial.');continue
  if name in seen:
   hold(c,t,m[0],'Repeated same-name evaluation row; no second project without source-specific identity distinction.');continue
  seen.add(name);row(c,t,name,raw,start=m.start(2),note='事業評価一覧表の担当課直後の独立した名称欄。評価年度のみ確定し、予算列・過年度決算列・複数年効果は実施FYに転用しない（R5委託料のみ表頭がR4実施と明記）。同名再掲/財源内訳は重複確認対象。')
 c['holds'].append(dict(start=0,raw=t[:150],status='layout_review',reason='Remaining inline department/title columns and displaced title blocks need source-family review; current accepted rows are only manually screened standalone bounded names. Actionable layout work remains, not missing text.'))
# Independently screened standalone printed title blocks in complete older books.
# Departments may be column-displaced; do not copy a neighboring department.
for c in [c for c in configs if c['sourceId'] in ['bf27718351b3efd1ba4a9126','b909ef57d1d483e7bb1a960b','e10e5f99515d7b20a94a49d3','f4df0a926e3fcc88af7357bb']]:
 t=verified_text(c['sourceId'],'42211');seen={r['name'] for r in c['rows']}
 for m in re.finditer(r'(?<=\n\n)([^\n]+(?:\n[^\n]+){0,2})(?=\n\n)',t):
  n=m[1].replace('\n','')
  if not(5<=len(n)<=55 and re.search(r'(事業|費|負担金|補助金|助成金|整備|管理|業務|運営|支援|給付|工事|健診|検診|保育|診査|調査|購入|教室|検査|設置|作成|更新|指導|研修|活動|教育|講座|保護)(?:[（(].+[）)])?$',n)):continue
  if any(x in n for x in ['。','、','ため','こと','する','により','について','年度','千円','・実','効果','対象','施策','指標','Ｈ','H2','R2','実施','<','＜','【','（ P.','（P.','①','②','１．','２．','３．','４．','５．','６．','７．','８．']):continue
  if n in seen:continue
  if n in generic or n.startswith(('スポーツ振興 ','消防本部','奈留支所','・','生涯学習活動施設','障害学習活動施設','子育て支援（')):
   hold(c,t,m[1],'Printed title candidate contains department/beneficiary or narrative/funding components. Exact original business-column boundary unresolved; excluded rather than guessed.');continue
  row(c,t,n,m[1],start=m.start(1),note='完結した冊子本文の独立した事業名欄。担当課の文字列は別列に移動するため隣接から補わない。資料表記の評価年度のみ、予算/過年度決算と実施年度を混同しない。金額なし。');seen.add(n)
# Subsidy-book titles are independently bounded before purpose/criteria paragraphs.
c=next(c for c in configs if c['sourceId']=='fdafa49cdd64eeb874dc4ed8');t=verified_text(c['sourceId'],'42211');seen={r['name'] for r in c['rows']}
for m in re.finditer(r'(?<=\n\n)([^\n]+(?:\n[^\n]+){0,3})(?=\n\n)',t):
 n=m[1].replace('\n','')
 if not(5<=len(n)<=60 and re.search(r'(補助金|交付金|奨励金|助成金)$',n)) or any(x in n for x in ['。','、','ため','こと','する','年度','千円','対象','指標','＜','【','（ P.','（P.','①','②']):continue
 if n in seen:continue
 row(c,t,n,m[1],start=m.start(1),note='令和３年度補助金等評価一覧の独立名称欄。FY2020決算とFY2021予算・将来方針が混在するため実施FYは空欄、評価年度2021のみ。金額・評価列は未抽出。');seen.add(n)

for id,ey,proof,names in [
 ('6d7ea16f5376396475f3df9a',2025,'令和７年度 事業評価一覧表', ['浄化槽設置整備事業','ＵＩターン促進事業（空き家活用促進事業補助金）','スポーツ交流人口拡大推進事業','スポーツ愛ランド推進事業費補助金','移動販売支援事業費補助金','三井楽地区公園清掃業務委託料','三井楽万葉まつり事業費補助金','戦略産品輸送費支援事業','会議録・五島市議会だより印刷製本費','ハラスメント相談窓口業務委託料','クリーンエネルギー利用促進事業費補助金','ごみ散乱防止パトロール業務委託料','結婚支援センター運営事業','観光案内業務委託料','五島市宿泊施設連絡協議会負担金','市観光協会運営費補助金','勤労福祉センター管理運営事業','富江半島ブルーライン健康ウォーク大会開催事業','魚津ヶ崎花づくり実行委員会補助金（菜の花まつり、あじさいまつり、コスモスまつり）','奈留島地場産品消費拡大事業']),
 ('5ae3c35511a9e71c34e41a2c',2023,'令和５年度 事業評価一覧表',['ふるさとづくり寄附金返礼業務委託料','ふるさと納税寄附受付等業務委託料','地域活動支援センター委託料','企業人材派遣委託料（R3～R5まで：3か年）','地域女性活躍推進業務委託料','関係人口創出業務委託料','五島産品島外販売促進業務委託料','滞在型観光推進事業委託料','磯焼け対策人材育成業務委託料','キャンプ魅力化促進事業委託料']),
 ('76fa5f5a3eacda3b9629d258',2021,'令和３年度',['介護人材確保対策事業補助金','スポーツ交流人口拡大推進事業費補助金','特定地域づくり事業推進補助金','バス路線維持費補助金','林業効率化機械等整備事業費補助金','家庭用浄水器等購入費補助金','障害者就業・生活支援センター事業費補助金','移住者向け住宅確保加速化支援事業補助金','巡回バス運行事業費補助金','地域産業雇用創出チャレンジ支援事業補助金','再生可能エネルギー分野先端技術開発支援事業費補助金','ＦＲＰ漁船リサイクル処理事業費補助金','浄化槽設置整備事業費補助金','市地球温暖化対策協議会補助金','生ごみ処理機購入費補助金','保育士等就労支援事業補助金','婚活支援事業補助金','農林漁業体験民宿拡大事業費補助金','まつり運営費補助金','農業大学校体験カレッジ受講支援事業費補助金','五島地鶏推進協議会補助金','被災住居林地等崩壊土砂撤去作業費補助金','地場産品消費拡大事業費補助金','魚津ヶ崎ふれあい交流事業実行委員会補助金（魚津ヶ崎公園グラウンド・ゴルフ大会）']),
 ('138839955fa27c73a8b625c6',2018,'平成３０年度',['自主制作番組放送・制作委託事業','映像配信システム機材のリース事業','電算共同化システム維持管理事業','光情報通信網運営事業','市社会福祉協議会運営費等補助金','生活館管理運営事業','富江地域福祉センター管理運営事業','保育体制強化事業費補助金','飲料水供給施設管理事業','巡回バス運行事業費補助金','市有墓地維持管理事業','路線バス維持費補助金','新生活交通維持費補助金','五島市地域公共交通活性化再生協議会負担金','販路拡大活動補助金','五島市宿泊施設連絡協議会負担金','観光イベント協力隊事業','スポーツ愛ランド推進事業費補助金','体育館管理運営事業','長崎五島ツーデーマーチ開催事業','担い手育成確保特別対策事業','産品センター鬼岳四季の里管理運営事業','森林環境保全整備事業','市営住宅維持管理事業','単独住宅維持管理','公園等管理事業','学校給食センター管理運営事業','山本二三美術館管理運営事業','奈留芸能館管理運営事業','玉之浦地区集会所管理事業','公民館活動事業','モンパルナス構想推進事業','三井楽万葉まつり開催事業'])]:
 c,t=source(id,'42211',None,proof);c['evaluationYear']=ey
 for name in names:
  pat=r'\s*'.join(map(re.escape,name));m=re.search(pat,t);assert m,(id,name)
  row(c,t,name,m[0],start=m.start(),note='見直し事業の評価対象名称。評価年度のみ。新規・拡大・縮小・廃止・計画を実績に転用せず、実施FYと金額は未確定。全体版との同名同年度再掲は重複除外する。')
 c['holds'].append(dict(start=0,raw=t[:150],status='layout_review',reason='Source-family review remains for displaced/interleaved title blocks and generic commission labels; no fields or duplicate components guessed.'))

# Flag near-alias variants inside a book for evidence review, never silently merge.
import unicodedata,builtins
for c in [c for c in configs if c['municipalityCode']=='42211']:
 groups={}
 for r in c['rows']:
  n=unicodedata.normalize('NFKC',r['name']);n=re.sub(r'\s+','',n);n=re.sub(r'(事業費補助金|事業補助金)$','補助金',n);n=re.sub(r'(関係経費|関係事業|事業費|事業|経費|費)$','',n);groups.setdefault(n,[]).append(r)
 reject={builtins.id(r) for rs in groups.values() if len({r['name'] for r in rs})>1 for r in rs}
 kept=[]
 for r in c['rows']:
  if builtins.id(r) in reject:c['holds'].append(dict(start=r['start'],raw=r['raw'],status='identity_or_period_hold',reason='Same-book near-alias title collision (business/expense/subsidy suffix); exact independence unresolved. Neither variant added, no fuzzy merge.'))
  else:kept.append(r)
 c['rows']=kept
# Explicit residual titles reviewed independently; generic fees, finance-source
# strings and narrative fragments are deliberately not in this allowlist.
residual_names='''2020国際ツバキ会議五島大会及び第30回全国椿サミット五島大会開催事業|まちづくり研修業務委託料|ケアマネジメントリーダー活動等補助金（介護保険事業特別会計）|コンビニ収納委託料|三井楽診療所診療業務委託事業（国民健康保険事業特別会計）|中小企業振興資金保証料補給金|中小企業振興資金利子補給金|久賀歯科診療所運営事業（国民健康保険事業特別会計）|二次離島地区デイサービス運営事業（介護保険事業特別会計）|五島市産品PR業務委託料|五島産品出荷受付事業委託料|五島食肉センター出資金|五島食肉センター管理業務委託料|介護予防サービス計画作成事業（介護保険事業特別会計）|介護予防ボランティア謝礼金支給事業（介護保険事業特別会計）|伊福貴診療所（歯科）運営事業（診療所事業特別会計）|低炭素建築物技術審査委託料|分別基準適合物再商品化委託料|創業資金融資保証料及び利子補給金|国境離島地域維持補助金（輸送コスト低廉化）|地域ミニデイサービス利用者送迎委託事業（介護保険事業特別会計）|地域活性化業務委託料|多面的機能支払交付金事業（旧：農地・水保全管理支払交付金事業）|奈留町すこやか祝金|子育て世帯臨時特例給付金|審査支払手数料（介護保険事業特別会計）|封書発送業務委託料|岐宿歯科診療所運営事業（国民健康保険事業特別会計）|市道・河川巡視業務委託料|幼児発達専門相談等業務委託料|後期高齢者医療制度特別対策補助金|意思疎通支援者養成事業委託料|持続可能な新水産業創造事業|有害ごみ処理業務委託料|林業就業支援講習業務委託料|椿園管理委託料|機構集積支援事業（旧農地制度実施円滑化事業）|母子家庭等自立支援給付金|母子家庭自立支援給付金|水道維持事業（水道維持費）（簡易水道事業特別会計）|海岸漂着物発生抑制啓発業務委託料|漁業振興資金利子補給金|漁業経営セーフティーネット構築事業積立金借入金利子補給金|漁業経営ｾｰﾌﾃｨﾈｯﾄ構築事業積立金借入利子補給金|漁業近代化資金利子補給金|特定健康診査の受診勧奨に関する町内会表彰事業(国民健康保険事業特別会計）|玉之浦診療所送迎バス運行委託事業（国民健康保険事業特別会計）|玉之浦診療所送迎バス運行委託料（国民健康保険事業特別会計）|玉之浦診療所（歯科）運営事業（国民健康保険事業特別会計）|生活困窮者家計改善支援業務委託料|生活困窮者自立相談支援業務委託料|生活支援ハウス等管理運営委託料|町内会業務委託料|畑地帯総合（担い手育成型）整備事業（土地改良区運営費補助金）|県林業公社林業開発促進資金貸付金|経営体育成基盤整備事業（農地利用集積円滑化事業支援事業費補助金）|経営改善貸付利子補給金|経営管理意向調査委託料|経営管理権集積計画作成委託料|給付型奨学金|老人福祉センター講座運営委託料|老人福祉施設入所委託料|職員研修委託料|臨時福祉給付金|議会中継インターネット配信業務委託料|資源ごみ選別作業委託料|軽自動車税申告書取扱事務委託料|農地制度実施円滑化事業|農業経営基盤強化資金利子補給金|道路植栽管理委託料|遣唐使ふるさと館管理業務委託料|配食サービス事業委託料|長期優良住宅技術審査委託料|障害支援区分認定調査委託料|障害者相談支援事業委託料|障害者虐待防止対策支援事業委託料|離島高校生修学支援費補助金（へき地児童生徒援助費補助金）|高崎地区漁業集落排水施設の維持管理事業（下水道事業特別会計）|高度へき地修学旅行費補助金（へき地児童生徒援助費補助金）|高額医療合算介護サービス費（介護保険事業特別会計）|鬼岳樹木園管理委託料|魚津ヶ崎ふれあい交流事業（魚津ヶ崎公園グラウンド・ゴルフ大会）|黄島（赤島）診療所運営事業（診療所事業特別会計）'''.split('|')
repairs={
 'こども未来課 へき地保育所運営委託料':'へき地保育所運営委託料','こども未来課 保育所管理運営委託料':'保育所管理運営委託料','こども未来課 利用者支援事業委託料':'利用者支援事業委託料','こども未来課 妊婦乳児訪問委託料':'妊婦乳児訪問委託料',
 '保育の質の向上のためのこども未来課研修事業等委託料':'保育の質の向上のための研修事業等委託料','地域子育て支援センターこども未来課事業委託料':'地域子育て支援センター事業委託料','妊婦・乳幼児健康診査委こども未来課託料':'妊婦・乳幼児健康診査委託料',
 '国保健康政策 スマート巡回診療推進事課業委託料':'スマート巡回診療推進事業委託料','国保健康政策 救急医療在宅当番医制委課託料':'救急医療在宅当番医制委託料','国保健康政策 第三者行為損害賠償求償課事務委託料':'第三者行為損害賠償求償事務委託料','国保健康政策 集団健診予約受付業務委課託料':'集団健診予約受付業務委託料',
 'スポーツ振興 B＆G海洋センタープール改課修事業':'B＆G海洋センタープール改修事業','スポーツ振興 スポーツ愛ランド推進事業費課補助金':'スポーツ愛ランド推進事業費補助金','スポーツ振興 スポーツ観戦ツアー事業課委託料':'スポーツ観戦ツアー事業委託料','スポーツ振興 三井楽市民プール管理業課務委託料':'三井楽市民プール管理業務委託料','スポーツ振興 五島市民体育大会開催費補課助金':'五島市民体育大会開催費補助金','スポーツ振興 市民体育館電動ブラインド改課修事業':'市民体育館電動ブラインド改修事業','スポーツ振興 市民体育館非常用放送設備課改修事業':'市民体育館非常用放送設備改修事業','スポーツ振興 水泳教室講師派遣業務委課託料':'水泳教室講師派遣業務委託料','スポーツ振興 玉之浦健康管理増進施設ス課ロープ設置工事':'玉之浦健康管理増進施設スロープ設置工事',
 '消防本部（総 小型動力ポンプ付積載車購務課）入事業':'小型動力ポンプ付積載車購入事業','消防本部（総 小型動力ポンプ積載車購入務課）事業':'小型動力ポンプ積載車購入事業','消防本部（総 小型動力ポンプ軽積載車購務課）入事業':'小型動力ポンプ軽積載車購入事業','消防本部（総 位置情報通知システム提務課）供業務委託料':'位置情報通知システム提供業務委託料','消防本部（総 気管挿管病院実習業務委務課）託料':'気管挿管病院実習業務委託料'}
repairs.update({
 'スポーツ振興 長崎国体開催準備事業委託課料（緊急雇用創出事業）':'長崎国体開催準備事業委託料（緊急雇用創出事業）',
 '商工雇用政策 企業PR動画作成業務委託課料':'企業PR動画作成業務委託料','商工雇用政策 経営コンサルタント派遣課業務委託料':'経営コンサルタント派遣業務委託料','商工雇用政策 雇用機会拡充事業事業計課画作成支援業務委託料':'雇用機会拡充事業事業計画作成支援業務委託料','商工雇用政策 雇用機会拡充事業審査業課務委託料':'雇用機会拡充事業審査業務委託料',
 '消防本部（総 五島市幼少年婦人防火委員務課）会補助金':'五島市幼少年婦人防火委員会補助金','奈留支所（地 五島市農作物等有害鳥獣被域振興課）害対策事業':'五島市農作物等有害鳥獣被害対策事業',
 '富江支所（地 富江町観光協会運営費補助域振興課）金':'富江町観光協会運営費補助金','教育総務課（生 青少年健全育成地区活動費補助涯学習推進班） 金':'青少年健全育成地区活動費補助金','玉之浦診療所送迎バス運行委託国保健康政策課 料（国民健康保険特別会計）':'玉之浦診療所送迎バス運行委託料（国民健康保険特別会計）',
 '社会生活基盤の整備 浄化槽設置整備事業':'浄化槽設置整備事業','商工雇用政策課 移動販売支援事業費補助金':'移動販売支援事業費補助金','スポーツを通じた地 五島長崎国際トライアスロン大域振興会開催事業':'五島長崎国際トライアスロン大会開催事業'})
def alias_key(n):
 n=re.sub(r'\s+','',unicodedata.normalize('NFKC',n));n=re.sub(r'(事業費補助金|事業補助金)$','補助金',n);return re.sub(r'(関係経費|関係事業|事業費|事業|経費|費)$','',n)
for c in [c for c in configs if c['municipalityCode']=='42211']:
 t=verified_text(c['sourceId'],'42211');seen={r['name'] for r in c['rows']};keys={alias_key(n):n for n in seen}
 for mt in re.finditer(r'(?<=\n\n)([^\n]+(?:\n[^\n]+){0,3})(?=\n\n)',t):
  n=mt[1].replace('\n','');name=repairs.get(n,n)
  if n not in residual_names and n not in repairs:continue
  if name in seen:continue
  key=alias_key(name)
  if key in keys:
   hold(c,t,mt[1],'Additional spelling/expense/subsidy variant may be the same existing candidate '+keys[key]+'. Preserve old row and hold new variant pending identity evidence; no fuzzy merge.');continue
  row(c,t,name,mt[1],start=mt.start(1),note='冊子の独立した名称断片を再確認。混入した担当課名は明示された文字列のみ分離し、隣接項目から推測しない。数値未抽出・評価年度と実施年度を分離。');seen.add(name);keys[key]=name

c,t=source('e304902291c4e995a319b69b','42205',None,'令和６年度 部局別事務事業評価結果一覧（継続事業及び補正新規事業）');c['evaluationYear']=2024
manual={11:'地理情報システム運営管理事業',26:'デジタル活用推進事業',97:'大村湾浮遊ゴミ・海岸漂着物等対策事業',98:'カーボンニュートラル促進事業',102:'動物愛護推進事業',103:'４Ｒ推進事業',133:'子ども医療費助成事業',280:'こども家庭センター事業',436:'政務活動費'}
seen=set()
for m in re.finditer(r'^(\d+) (.+)$',t,re.M):
 n=int(m[1]);assert 1<=n<=550 and n not in seen;seen.add(n)
 if n in manual:continue
 assert not m[2].startswith(('（旧','(旧','※'))
 row(c,t,m[2],m[0],start=m.start(),note='令和６年度評価一覧の明示番号付き事業名。継続/補正新規の区分から決算年度は推定せずFY空欄。旧名称・統合前事業・予算/評価印は別レコードにしない。同名番号の区別は重複保留。')
for n,name in manual.items():
 row(c,t,name,note='番号'+str(n)+'に対応する独立した現名称欄。括弧内旧名称や統合前事業を別事業にしない。評価年度2024のみ。');seen.add(n)
hold(c,t,'325\n\n農林水産整備課\n\n326','No business title is present next to row325 in saved text; other department/number/title blocks cannot identify it uniquely. Need original row geometry or a matching explicit title; no municipal fetch.')
assert seen==set(range(1,551))-{325}
for id,proof in [('17ddb8cc000e56ec78aa66eb','令和７年度'),('5186e82ae4098ce535a2bd47','令和６年度')]:
 c,t=source(id,'42205',None,proof);hold(c,t,t[:180],'Overview gives aggregate counts and evaluation process, not individual business identities. Existing numbered business list is reviewed separately; no aggregate/project inflation.')
c,t=source('eb7c4963f89c3b5aab6c1089','42205',2024,'Ｒ６\n\nＲ７\n\n決算');row(c,t,'結婚応援事業',note='単一事業の評価表のR6決算列によりFY2024のみ。R7予算・見込決算・R8予算と区別し、評価年度や列金額は推定しない。番号付き年度一覧との同名重複を照合。')
c['rows'][0].update(context=t,contextStart=0)
c,t=source('f24d5a155386897bfca59990','42205',None,'結婚応援事業');hold(c,t,'結婚応援事業','Same marriage-support identity as single-sheet evaluation eb7c4963f89c3b5aab6c1089. This overview has start year H30 and planned/forecast amounts but no explicit report/evaluation year; start year is not evaluated fiscal year. No duplicate or numeric enrichment.')
for id,ey,proof,names in [
 ('005c3e999da8e4cca64aaf50',2025,'令和７年度 事務事業評価結果一覧表',['自主防災会リーダー研修視察','保育所等副食費助成事業','子ども家庭総合支援拠点運営事業','子育て世代包括支援センター経費','産後ケア事業','地域計画推進事業','限定特定行政庁','小・中学校ICT推進事業','子育て応援新入児童通学用かばん支給事業','島原市中学校体育大会補助金','各種研究大会・発表大会派遣費補助金','埋蔵文化財範囲確認調査事業','市民親睦各種大会']),
 ('89e0a5757437c3cc059884ed',2024,'令和６年度 事務事業評価結果一覧表',['広報諸費（広報しまばら作成経費）','葉たばこ病害虫防除対策費補助金','有明農林漁業体験実習施設「舞岳山荘」管理運営費','森林環境譲与税活用事業','島原でしてみんねテレワーク支援事業補助金','障害児保育事業費補助金','発達促進保育事業費補助金','すこやか赤ちゃん支援事業','歯科保健事業','島原市社会福祉協議会運営費補助金','成年後見制度利用促進に係る中核機関運営業務','保健事業と介護予防の一体的実施事業','島原市シルバー人材センター運営費補助金','肥前島原子ども狂言ワークショップ','フッ化物洗口推進事業（小中学校）','教育文化振興事業団運営費補助金','市民体育祭運営経費','島原市地方バス路線維持費補助金','島原市定住促進通勤支援補助金','島原市自衛隊家族会補助金','公衆便所清掃業務','公害対策経費','町内会・自治会活動傷害保険加入費補助金','浄化槽設置整備事業'])]:
 c,t=source(id,'42203',None,proof);c['evaluationYear']=ey
 for name in names:row(c,t,name,note='年度評価結果一覧の個別事業名。政策見出しや判定件数を事業化せず、次年度予算を実績に転用しない。評価年度のみ、実施FY・金額・段階別評価は未抽出。')
c,t=source('072f4f471395e72b15d05408','42203',None,'事務事業評価 / 島原市');hold(c,t,t[:120],'Cached ASPX article index, not PDF individual business sheets. Link/publication years alone do not provide project records.');c['reviewStatus']='navigation'


# Additional bounded cached title review, retaining earlier accepted rows.
c=next(c for c in configs if c['sourceId']=='6d7ea16f5376396475f3df9a');t=verified_text(c['sourceId'],'42211')
for name in ['体育スポーツ振興補助事業','地域の絆再生事業','スクールバス運行事業','小学校プール管理運営事業','少年センター運営事業']:
 row(c,t,name,note='令和７年度見直し一覧に明示された名称。過年度実績と将来予算が混在し実施FYは空欄。構成する指標・委託費を別事業にしない。')
for name,raw in [
 ('三井楽給食センター管理運営事業','教育総務課（総 三井楽給食センター管理運営事\n務班）\n業'),
 ('福江総合福祉保健センター外部改修工事','福江総合福祉保\n施設の長寿命化のため、\n社会生活基盤の\n雨漏りや外壁のひび割れ等の劣化が\n・屋上防水\n健センター外部\n年次的に施設の改修を行\n整備\n見られる。今後も既存施設を安全に\n・外壁塗装\n改修工事'),
 ('魚津ヶ崎公園施設改修事業','持続可能な観光 魚津ヶ崎公園施 劣化が著しく、施設の損傷が進んで\n基盤づくり\n設改修事業'),
 ('地区公民館照明LED化改修事業','地区公民館照明\nティプロジェク\n蛍光灯の製造等が中止となるため、\nLED化改修事業'),
 ('三井楽町公民館空調機取替修繕','社会生活基盤の 三井楽町公民館 し、稼働できていない箇所がある。\n整備\n空調機取替修繕')]:
 row(c,t,name,raw,note='令和７年度事前見直し対象のハード事業名称。整備計画/設計/予算を完成実績にせず、実施FY・費用・工事完了は未入力。政策欄と説明欄の文字は名称に混入させない。')
row(c,t,'三井楽町公民館屋上防水・外壁改修工事','三井楽町公民館\n社会生活基盤の\n被害が拡大しているため、社会教育\n屋上防水・外壁\n整備\n施設・指定避難所の安全対策、施設\n改修工事',note='FY2025評価の工事計画名。実施方針は屋上防水のみで外壁は採択されていない。原案名を残し、完成/全工事実施/決算を推定しない。')
row(c,t,'電算システム使用料（AIチャットボット、支所・本庁間デジタル相談窓口）','電算システム使用料（AIチャッ\nトボット、支所・本庁間デジタ\nル相談窓口）',note='正式な評価対象欄の合同事業名を一件として保持。AIと相談窓口を二事業に分割せず、使用人数を事業数や決算額に転用しない。')
# Retain ambiguity of generic commissions rather than inventing a new project
# for each purpose/contract component listed beside the generic accounting name.
for c in [c for c in configs if c['municipalityCode']=='42211']:
 t=verified_text(c['sourceId'],'42211')
 accepted={r['start']:r for r in c['rows']}
 for h in c['holds']:
  if h['start'] in accepted and h['raw']==accepted[h['start']]['raw']:
   h['status']='resolved_title_boundary';h['reason']='Exact title/department fragments now resolved in an accepted row at this offset. Financial/indicator columns remain unextracted.'
 if c['sourceId'] in ['bf14284043f1216d18ae4d1d','5ae3c35511a9e71c34e41a2c']:
  for mt in re.finditer(r'(?<=\n\n)(管理業務委託料|運営業務委託料|運用保守業務委託料|運転管理業務委託料|コンサルティング業務委託料|健診業務委託料|植栽委託料|イベント開催委託料)(?=\n)',t):
   c['holds'].append(dict(start=len(t[:mt.start()].encode('utf-16-le'))//2,raw=mt[0],status='identity_or_period_hold',reason='Generic commission name repeats across facilities/purposes. Flat text does not uniquely bind the accounting row to one individual title and budget entity; purpose subheadings may be components, not independent projects. Original row geometry or explicit identity mapping required, no source request.'))

c,t=source('7debebb80c1bb074651a0ac6','42207',2012,'平 成 24 年 度\n主要な施策の成果')
ms=list(re.finditer(r'([^\n]+(?:\n[^\n]+){0,2})\n[（(][^\n]{1,35}[）)]\n【事項別明細書 [^\n]+】',t))
assert len(ms)==109
skip={1,2,5,13,14,15,16,24,25,31,39,46,49,50,55,56,58,67,72,75,78,79,80,81,85,87,96,100,102,104,107}
# Exact reviewed titles after preceding narrative, not generic tail fragments.
lastlines={43:1,45:2,70:2,71:1,74:2,77:2,92:1}
for n,m in enumerate(ms):
 if n in skip:
  c['holds'].append(dict(start=len(t[:m.start(1)].encode('utf-16-le'))//2,raw=m[1],status='layout_review',reason='Title fragment is incomplete or generic; review the displaced saved title prefix before accepting. No guessed association or numeric fields.'))
  continue
 raw='\n'.join(m[1].splitlines()[-lastlines[n]:]) if n in lastlines else m[1]
 name=re.sub(r'\s+','',raw)
 row(c,t,name,raw,start=m.start(1)+m[1].index(raw),note='平成24年度決算成果報告の事業名・担当課・事項別明細書ページの連続した境界を確認。金額列、施策見出し、内訳の個別工事は転記しない。')
c['holds'].append(dict(start=0,raw=t[:100],status='layout_review',reason='Remaining displaced title blocks throughout full 157030-character book require title-prefix review; accepted rows are not proof of full coverage.'))
# Explicit page-local prefix/suffix pairs, reviewed together with department and narrative.
repairs={1:('人事評価制度構築','人事評価制度構築事業'),2:('情報格差等対策事','情報格差等対策事業'),5:('地域間交流推進事','地域間交流推進事業'),13:('民生委員児童委員','民生委員児童委員設置事業'),16:('障害者自立支援給','障害者自立支援給付費等事業'),31:('子育て 支援交付','子育て支援交付金事業'),39:('ストックヤード','ストックヤード整備事業'),46:('農地・水保全管理','農地・水保全管理支払交付金事業'),49:('農産物加工新商品','農産物加工新商品開発支援事業'),50:('強い農業づくり交','強い農業づくり交付金事業'),55:('自然災害防止事業','自然災害防止事業県工事負担金'),56:('地域ため池総合整\n備事業県工事負担','地域ため池総合整備事業県工事負担金'),58:('海岸防災林造成事','海岸防災林造成事業県工事負担金'),67:('水産業普及指導事','水産業普及指導事業'),72:('漁港整備事業県工事負担金','漁港整備事業県工事負担金'),75:('平戸冨春園誘客促','平戸冨春園誘客促進事業'),79:('平戸観光振興強化','平戸観光振興強化事業'),80:('観光トップセール','観光トップセールス事業'),81:('東アジア観光誘客','東アジア観光誘客推進事業'),85:('辺地対策道路整備','辺地対策道路整備事業'),96:('防災行政無線施設','防災行政無線施設整備事業'),100:('学校図書館支援員','学校図書館支援員配置事業'),102:('少年の主張大会開','少年の主張大会開催事業'),107:('第 69 回国民体育大','第69回国民体育大会平戸市実行委員会運営事業')}
for n,(prefix,name) in repairs.items():
 m=ms[n]; lo=max(0,m.start()-600);hi=min(len(t),m.end()+600);hits=list(re.finditer(r'(?m)^'+re.escape(prefix)+r'$',t[lo:hi]));assert len(hits)==1,(n,prefix)
 pp=lo+hits[0].start();start=min(pp,m.start(1));end=max(pp+len(prefix),m.end());raw=t[start:end]
 row(c,t,name,raw,start=start,note='同一ページの担当課・明細書頁・説明と印刷された名称前後片を個別照合。年度2012の事業名のみ、内訳や財源列を独立事業/費用にしない。')
 old=next(h for h in c['holds'] if h['start']==len(t[:m.start(1)].encode('utf-16-le'))//2);old.update(status='resolved_title_boundary',reason='Exact page-local printed prefix/suffix reviewed with source department and description; accepted title retains entire intervening quote, no monetary alignment inferred.')


c,t=source('aea3a69441b0008158d6a8a7','42209',None,'事後評価実施時期\n\nH26年度');c['evaluationYear']=2014
for name in ['道路(国分寺線、厳原小学校線、日吉地区内線、横町線)','地域生活基盤施設（宮内広場、案内板）','高質空間形成施設(照明施設、電線類地下埋設施設、歩行者支援施設）','地域創造支援事業（幼稚園建設事業、既存建物解体･除却）']:
 row(c,t,name,note='当初計画で実施した事業欄の合同名称を一件として保持。複数施設を別事業へ分割せず、H22～26の交付期間を単年度決算にしない。評価年度2014のみ。')
for name,raw in [('道路（鍛冶屋小路）','道路（鍛冶屋小路、第1回）'),('高次都市施設（観光交流センター）','高次都市施設（観光交流センター、第3回）'),('地域生活基盤施設（日吉広場）','地域生活基盤施設（日吉広場、第4回）'),('地域創造支援事業(既存建物移設、高麗門移設)','地域創造支援事業(既存建物移設、高麗門移設、第7回)'),('公園(宮谷公園)','公園(宮谷公園、第7回)')]:
 row(c,t,name,raw,note='追加事業欄の個別名称。変更回数を年度/事業コードに使わない。削除された旧区分・同一建物解体の重複は追加しない。実施FYと費用は空欄。')
for raw,reason in [('高質空間形成施設（裏笠渕通り、第1回）','Added street group overlaps original high-quality-space group; upper Miyadani and Kaneishi later removed. Exact independent budget entity required to split safely.'),('事業活用調査、まちづくり活動推進事業','Generic plan administration categories have no individual identity; not split into projects.'),('地域創造支援事業(既存建物解体･除去、第4回）','Demolition may duplicate original kindergarten/demolition group. Independent scope not established.'),('道路（裏笠渕通り、第1回）、道路（上宮谷線、第1回）','Deleted/reclassified original roads excluded; no implementation inferred.'),('高質空間形成施設(上宮谷線、第7回)','Explicitly removed. Earlier addition is not a second implemented project.'),('公営住宅等整備(高齢者施設、第4回)','Explicitly removed; not an implemented project.')]:hold(c,t,raw,reason)
c,t=source('74e2193f892d45e29baaf84a','42204',None,'事後評価実施時期\n\n令和5年度');c['evaluationYear']=2023
for name in ['道路（市道諫早停車場線）','道路（諫早駅西交通広場）','道路（市道諫早駅前２号線）','道路（市道永昌東栄田線）','地域生活基盤施設（諫早駅自由通路）','高質空間形成施設（電線地中化）','高次都市施設（交流広場）','市街地再開発事業（諫早駅東地区）','道路（市道永昌東福田線）','道路（仮称：諫早駅北側用地周回道路）','高質空間形成施設（諫早駅東交通広場モニュメント整備）']:
 row(c,t,name,note='令和5年度の事後評価対象名。R1～R5の交付期間を単年度実績にせず、廃止通路・ポンプと重複し得る駐輪場内訳は除外。費用/指標/実施FYは未入力。')
for raw,reason in [('地域生活基盤施設（諫早駅東連絡通路）','Explicitly deleted later in the same sheet, despite initial implemented-list label. Not accepted.'),('地域生活基盤施設（市道永昌東福田線内水排水ポンプ改良事業）','Deleted with no expected implementation during grant period.'),('地域生活基盤施設（諫早駅東口自転車駐車場）','Three later parking facilities may be components of original generic bicycle-parking grant project. Independent project/budget identity required before splitting.'),('事業活用調査（事後評価）','Evaluation administration category without independent business identity.')]:hold(c,t,raw,reason)
for id,fy,ey,proof,pairs in [
 ('af3f21463c48a2f301e211c6',2025,None,'令和７年度6月補正予算に係る事務事業評価会議 評価結果一覧',[('学校安全推進体制構築事業費','学校安全推進体制構築事業費'),('旧長崎英国領事館運営費(オープニングセレモニーの開催)','旧長崎英国領事館運営費(オープ\nニングセレモニーの開催)')]),
 ('8413e7bcb72b9106d95acefd',2025,None,'令和７年度補正予算事務事業評価一覧表',[('自治会集会所省エネ空調設備導入補助金','自治会集会所省エネ空調\n設備導入補助金'),('販路開拓促進事業費（長崎市産品振興による地域活性化事業）','販路開拓促進事業費（長\nC1-3 崎市産品振興による地域\n活性化事業）')]),
 ('270033ef077b8ebdb521144c',2024,2024,'令和６年度事務事業評価（R６年度11月補正予算に係る事前評価）一覧表',[('第11回平和首長会議総会開催費負担金','第11回平和首長会議総会開催費\n負担金')])]:
 c,t=source(id,'42201',fy,proof)
 if ey:c['evaluationYear']=ey
 for name,raw in pairs:row(c,t,name,raw,note='補正予算に係る事前評価対象。FYは明記された予算対象年度で、実施済み/決算/支出を示さない。評価年度は明示がある場合のみ。金額や採択欄は未転記。')

def exact_wrapped(c,t,name):
 # Only literal printed characters; tolerate whitespace and explicit policy-column labels.
 gap=r'(?:\s|[A-H][1-7]-[1-9]|新規|拡大)*'
 matches=list(re.finditer(gap.join(re.escape(ch) for ch in name),t));assert matches, name
 m=matches[0]
 row(c,t,name,m[0],start=m.start(),note='予算事前評価の明記された名称。FYは予算対象年度で実施/決算実績ではない。同じ親事業の複数拡大項目は一名称にまとめ、金額・採択評価・実績を推定しない。改行と政策コード欄のみ除去。')
 return m
c,t=source('a193f2dcbd31d18453935ece','42201',2025,'令和７年度当初予算に係る事務事業評価会議 評価結果一覧')
names='''災害対策事業費
被災者台帳作成システム整備費
総合計画策定費
ながさきカップル応援事業費
人口減少対策シンポジウム開催費負担金
広報戦略推進費
セントポール市姉妹都市提携70周年記念事業費
都市提携及び親善交流費
人事給与管理システム運営費
職員安全衛生管理費
デジタル化推進費
庁内ネットワーク運営費
未収金対策費
まちづくり活動推進費
地域コミュニティ推進事業費
平和祈念式典行事費
「平和の文化」醸成事業費・平和推進活動費
原爆資料館運営費
「長崎クスノキプロジェクト」推進費
保存整備活動費
生涯元気事業費
介護予防普及啓発事業費
健康長崎市民21普及費
保健所総務費
後期高齢者保健事業及び介護予防一体的実施事業費
子育て支援センター運営費
子ども食堂開設応援費
ファミリー・サポート・センター運営費
五歳児健康診査費
妊産婦健康診査費
病児・病後児保育費
保育士等サポート事業費補助金
こども誰でも通園事業費補助金
私立幼稚園振興費補助金
民間移譲円滑化補助金
相談アプリ導入費
資源循環推進費
ふれあい訪問収集事業システム導入
若年者雇用促進費
多様な人材雇用促進費
経済成長戦略策定費
ものづくり技能労働者人材育成助成金
技能人材スキルアップ支援事業
デジタル人材確保支援費
伴走型デジタル化支援補助金
産学連携・創業支援費
商店街等プロモーション事業費
中央卸売市場開設50周年記念事業費
インバウンド誘致広域連携事業費
史跡高島炭鉱跡整備基本計画改訂支援業務
長崎学研究所開所10周年記念事業費
長崎ペンギン水族館運営費
スマート水産業推進費
水産資源再生事業費
市内漁協漁業・流通実態調査
森林整備促進費
農業新規参入促進施設
道路占用管理システムの導入
老朽危険空き家対策推進費
国際理解教育推進費
参議院議員通常選挙費事務費
長崎県知事選挙費事務費'''.splitlines()
for name in names:
 if name=='ファミリー・サポート・センター運営費':
  row(c,t,name,'ファミリー・サポート・センター運営\nF4-3\nト課\n費',note='明示された事業名の改行間に混在した子育てサポート課の末尾を分離。FY2025予算事前評価対象であり実績ではない。');continue
 if name=='ものづくり技能労働者人材育成助成金':
  row(c,t,name,'ものづくり技能労働者人材育成助\n新産業推進課 C1-2\n部\n成金',note='担当課・部の列が混在した名称を個別確認。FY2025予算事前評価で実績/金額未抽出。');continue
 exact_wrapped(c,t,name)
hold(c,t,'事務事業名','Remaining titles before page headings, and transport parent/subsidy identity, require explicit printed-row review. Not full coverage.');c['holds'][-1]['status']='layout_review'

c,t=source('a19867f92ab9c4a45ccc1def','42201',2024,'令和5年度事務事業評価（R6年度当初予算に係る事前評価）一覧表');c['evaluationYear']=2023
for name in ['広報戦略推進費','若者交流施設運営費','地域コミュニティ推進事業費','九州市長会開催費','文書費事務費','まちづくり活動推進費','国民文化祭開催推進費','市民参加舞台','プロスポーツ応援事業','消費生活相談費','第７回核兵器廃絶－地球市民集会ナガサキ開催費負担金','成年後見制度利用支援事業','認定調査事務費','地域障害児支援体制強化事業費','ICT導入モデル事業費補助金','精神障害者ピアサポーター活用事業費','医療的ケア児レスパイト事業費','看護師等確保支援費','がん検診等事業費','特定健康診査受診率向上対策費','世界・日本新三大夜景推進事業費','旧オルト住宅展示整備費','グラバー園運営費','洋館活用事業手法検討事業','「長崎と天草地方の潜伏キリシタン関連遺産」推進費','軌道施設浸水対策事業費','マンション管理適正化推進事業費','建築指導行政費']:exact_wrapped(c,t,name)
assert len(c['rows'])==28
hold(c,t,'成年後見制度利用支援事業（報','30 printed assessment rows include two repeated parent project identities (public relations and adult guardianship). Retained one parent per fiscal year; no component inflation.')
c,t=source('6f7d7e52311c80c17a1adeeb','42201',2024,'令和６年度２月補正予算に係る事務事業評価会議 評価結果一覧')
for name in ['災害対策活動費','ＩＣＴ機器等導入事業費補助金','医療機関物価高騰緊急支援事業費','子育て家庭生活支援給付金支給事業費','チャレンジ企業応援事業費','GX推進補助金','商店街等プレミアム付商品券等発行支援事業','商店街等にぎわい創出支援費補助金','食・観光高付加価値化事業費','販路開拓支援事業費','インセンティブ旅行誘致促進事業費','漁協経費負担軽減対策事業費','畜産用飼料価格高騰対策費補助金']:exact_wrapped(c,t,name)
for name,raw in [('長崎スタジアムシティ開業気運醸成費','長崎スタジアムシティ開業気運\nティ連携推進 G3-2\n部\n醸成費'),('妊婦等生活支援特別給付金給付事業費','妊婦等生活支援特別給付金給\nF4-2\nト課\n付事業費'),('省エネルギー家電製品等購入費補助金','省エネルギー家電製品等購入\nD1-1\nシティ推進室\n費補助金')]:row(c,t,name,raw,note='R6補正予算の事前評価対象名。印字された部/担当課の混入箇所を個別照合し、給付金と事務費や内訳を別事業化しない。実績や評価年度は推定しない。')
assert len(c['rows'])==16


c,t=source('8283a643c47f93015970068d','42201',2025,'令和７年度1～２月補正予算に係る事務事業評価結果一覧表')
for name in ['地域子ども・子育て支援事業継続支援費','民間保育所等副食費支援補助金','チャレンジ企業応援事業費','スマート農業技術導入支援事業費補助金','施設園芸等燃油価格高騰対策費補助事業','生産・加工基盤整備事業','公共交通運転士確保緊急補助金']:exact_wrapped(c,t,name)
for name,raw in [('長崎市職場環境改善事業費補助金','長崎市職場環境改善事業費補\n新産業推進課 C1-①\n部\n助金'),('漁業経営セーフティネット（燃油・配合飼料）構築支援事業費補助金','漁業経営セーフティネット（燃油・\n水産振興課 C3-① 配合飼料）構築支援事業費補助 新規\n金'),('農水産物直売所プレミアム付商品券発行支援費補助金','農水産物直売所プレミアム付商\nC1-③\n新規\n部\n農林振興課\n品券発行支援費補助金'),('【単独】水産業振興対策事業費負担金・補助金（漁業経営基盤強化支援費）','【単独】水産業振興対策事業費\n水産振興課 C3-① 負担金・補助金\n漁業経営基盤強化支援費')]:row(c,t,name,raw,note='R7補正予算の事前評価対象。名称に混在した担当課列のみ個別分離。親費目と内訳を一件に保持し、決算/実施済み/評価年度を推定しない。')
hold(c,t,'【単独】都市交通対策事業費','Parking/transport heading and subsidy-name suffix are separated by intervening table cells; verify full parent/subsidy title before accepting.');c['holds'][-1]['status']='layout_review'
c,t=source('5b6d160570f5a2e7fb1d4576','42201',2026,'令和７年度事務事業評価（令和８年度当初予算に係る事前評価）一覧表');c['evaluationYear']=2025
for name in ['災害対策本部の機能整備','市主催防災訓練','企画費事務費','まちのにぎわい創出事業費','子ども体験創出事業費','くらしの魅力創出事業費','広報戦略推進費','公用車一元管理システム整備費','デジタル化推進費','芸術文化シンポジウム開催費','緊急時訪問介護事業','ひとり親家庭等生活・学習支援事業費事業','子育て応援情報発信費','子ども食堂開設応援費','子育て支援センター運営費','妊産婦健康診査費','乳児期家事代行サービス事業','保育士等サポート事業費補助金','放課後児童健全育成事業','長崎市浄化槽設置整備事業補助金','若年者雇用促進費','新産業・起業チャレンジ促進費','観光客誘致推進費','世界・日本新三大夜景推進費','漁場施設機能保全事業費','新規漁業就業促進事業','グリーンツーリズム推進事業費','森林整備促進費','長崎びわ生産推進事業費補助金','歴史的風致維持向上推進費','地域活性化事業','団員確保対策費']:exact_wrapped(c,t,name)
hold(c,t,'事務事業名','Remaining printed title blocks before repeated headings require review; page-header selection is not exhaustive.');c['holds'][-1]['status']='layout_review'


for name in ['テレビ・新聞等広報費','インターネット情報発信費','広報誌等発行費','乳幼児インフルエンザ予防接種費','こども医療対策費','母子父子福祉資金貸付金','親子歯科口腔保健費','五歳児健康診査費','産学連携・創業支援費','GX推進事業費','ものづくり支援費','企業版ふるさと納税推進費','販路開拓推進事業','第67期将棋王位戦開催地負担金','総合観光案内所運営費','亀山社中記念館運営費','池島炭鉱体験施設運営費','長崎港クルーズ客船受入委員会負担金','長崎さるく推進費','通信指令費','【単独】恐竜博物館施設整備事業費','キャリア教育推進事業費']:exact_wrapped(c,t,name)
row(c,t,'担い手農家支援施設費補助金','費補助金 担い手農家支援施設',note='R8予算事前評価の印字名称で前後逆順となったタイトル片を確認。畜産施設の長寿命化支援という同一行の説明を証拠に保持。実績/費用/補助対象数は未入力。')
c['rows'][-1].update(context=t[t.index('費補助金 担い手農家支援施設'):t.index('費補助金 担い手農家支援施設')+1300],contextStart=len(t[:t.index('費補助金 担い手農家支援施設')].encode('utf-16-le'))//2)
c['holds'][-1].update(status='reviewed_duplicate_components',reason='All 59 printed rows reviewed: 55 parent identities; digital-promotion repeats once, new-industry/startup repeats twice, career education repeats once. Retain one parent per target fiscal year, no expenditure or implementation inference.')
assert len(c['rows'])==55


c=next(x for x in configs if x['sourceId']=='a193f2dcbd31d18453935ece');t=verified_text(c['sourceId'],'42201')
for name in ['新規漁業就業促進事業','担い手農家支援施設','有害鳥獣対策費']:exact_wrapped(c,t,name)
row(c,t,'【単独】都市交通対策事業費（タッチ決済導入事業費補助金）','【単独】都市交通対策事業費\nタッチ決済導入事業費補助金',note='R7予算事前評価の同一番号の親費目・補助金名を一件として保持。実施済み、支出、評価年度は推定しない。')
c['holds'][-1].update(status='reviewed_duplicate_components',reason='All 73 numbered proposal rows reviewed as 66 parent identities: digital promotion repeats three times; overdue collections, diverse employment, wildlife and forest development repeat once each. Unnumbered 80th-anniversary heading is not a project. Planned budget fields only.')
assert len(c['rows'])==66
c=next(x for x in configs if x['sourceId']=='8283a643c47f93015970068d');t=verified_text(c['sourceId'],'42201')
start=t.index('事業費補助金',t.index('公共交通運転士確保緊急補助'));end=t.index('区分',start)
row(c,t,'【単独】都市交通対策事業費（公共交通バリアフリー車両導入事業費補助金）',t[start:end],start=start,note='R7補正予算事前評価の公共交通バリアフリー車両導入という印字名と、移動した事業費補助金の末尾を確認。親費目と内訳を一件で保持。運転士確保の別行と混同せず金額未抽出。')
c['holds'][-1].update(status='resolved_title_boundary',reason='Printed suffix and full title resolved in the same page; all 12 numbered assessment rows accounted for. Retained parent plus subsidy as one project, not two.')
assert len(c['rows'])==12


c=next(x for x in configs if x['municipalityCode']=='42207');t=verified_text(c['sourceId'],'42207')
rs=[{'name': '農業集落排水事業', 'raw': '農業集落排水事業', 'start': 484}, {'name': '宅地開発事業', 'raw': '宅 地 開 発 事 業', 'start': 514}, {'name': 'あづち大島いさりびの里事業', 'raw': 'あづち大島いさりびの里事業', 'start': 547}, {'name': '市民表彰制度事業', 'raw': '市民表彰制度事業', 'start': 7100}, {'name': '移動市長室開催事業', 'raw': '移動市長室開催事\n業', 'start': 7430}, {'name': '益法人移行事業', 'raw': '益法人移行事業', 'start': 7699}, {'name': 'くり推進事業', 'raw': 'くり推進事業', 'start': 10022}, {'name': '・まちづくり活性化交付金', 'raw': '・まちづくり活性化交付金', 'start': 10649}, {'name': '支援交付金事業', 'raw': '支援交付金事業', 'start': 10798}, {'name': '定住促進対策事業', 'raw': '定住促進対策事業', 'start': 11340}, {'name': 'ジェクト事業', 'raw': 'ジェクト事業', 'start': 11950}, {'name': '国土調査事業', 'raw': '国土調査事業', 'start': 13871}, {'name': '離島航路対策事業', 'raw': '離島航路対策事業', 'start': 14851}, {'name': '高島地区航路対策事業', 'raw': '高島地区航路対策\n事業', 'start': 15050}, {'name': '人権問題啓発事業', 'raw': '人権問題啓発事業', 'start': 16804}, {'name': '市民総合相談開催事業', 'raw': '市民総合相談開催\n事業', 'start': 16951}, {'name': '収納対策推進事業', 'raw': '収納対策推進事業', 'start': 18090}, {'name': 'に対して助成した。社会福祉協議会運営補助金', 'raw': 'に対して助成した。\n社会福祉協議会運営補助金', 'start': 23771}, {'name': '社会福祉センター運営補助金', 'raw': '社会福祉センター運営補助金', 'start': 23806}, {'name': '生委員児童委員で構成される民生委員児童委員協議会連合会に対し、活動費等の助成を行った。民生委員児童委員協議会連合会補助金', 'raw': '生委員児童委員で構成される民生委員児童委員協議会連合会に対し、\n活動費等の助成を行った。\n民生委員児童委員協議会連合会補助金', 'start': 24348}, {'name': '戦没者追悼事業', 'raw': '戦没者追悼事業', 'start': 24514}, {'name': '地域生活支援事業', 'raw': '地域生活支援事業', 'start': 25123}, {'name': '○移動支援事業', 'raw': '○移動支援事業', 'start': 25293}, {'name': '○地域活動支援センター事業', 'raw': '○地域活動支援センター事業', 'start': 25811}, {'name': '○手話奉仕員派遣事業', 'raw': '○手話奉仕員派遣事業', 'start': 25993}, {'name': '○身体障害者補助犬飼育管理助成事業', 'raw': '○身体障害者補助犬飼育管理助成事業', 'start': 26087}, {'name': 'クシー助成事業', 'raw': 'クシー助成事業', 'start': 26291}, {'name': '福祉医療給付事業', 'raw': '福祉医療給付事業', 'start': 27356}, {'name': '活動団体に対して助成した。在宅重度障害者と学生ボランティアとのふれあい研修事業', 'raw': '活動団体に対して助成した。\n在宅重度障害者と学生ボランティアとのふれあい研修事業', 'start': 27617}, {'name': '応じた障害福祉サービスを行った。○補装具給付事業', 'raw': '応じた障害福祉サービスを行った。\n○補装具給付事業', 'start': 27901}, {'name': '○介護給付サービス事業', 'raw': '○介護給付サービス事業', 'start': 28085}, {'name': '短期入所事業', 'raw': '短期入所事業', 'start': 28332}, {'name': '生活介護事業', 'raw': '生活介護事業', 'start': 28359}, {'name': '療養介護事業', 'raw': '療養介護事業', 'start': 28405}, {'name': '○訓練等給付サービス事業', 'raw': '○訓練等給付サービス事業', 'start': 28484}, {'name': '○サービス利用計画作成事業', 'raw': '○サービス利用計画作成事業', 'start': 28802}, {'name': '更生医療給付事業', 'raw': '更生医療給付事業', 'start': 29412}, {'name': 'ラブ連合会及び単位老人クラブに対し、活動を推進するための運営費', 'raw': 'ラブ連合会及び単位老人クラブに対し、活動を推進するための運営費', 'start': 30901}, {'name': '世代間交流事業', 'raw': '世代間交流事業', 'start': 31031}, {'name': 'くりサポート事業', 'raw': 'くりサポート事業', 'start': 31218}, {'name': '介護予防具設置事業', 'raw': '介護予防具設置事\n業', 'start': 31680}, {'name': '療養給付事業', 'raw': '療養給付事業', 'start': 33358}, {'name': '運営支援事業', 'raw': '運営支援事業', 'start': 33965}, {'name': '○地域子育て支援拠点事業', 'raw': '○地域子育て支援拠点事業', 'start': 35217}, {'name': '応するため、各種保育事業に対する助成を行った。○休日保育事業', 'raw': '応するため、各種保育事業に対する助成を行った。\n○休日保育事業', 'start': 35406}, {'name': '地域子育て支援事業', 'raw': '地域子育て支援事業', 'start': 36445}, {'name': '○延長保育事業', 'raw': '○延長保育事業', 'start': 36531}, {'name': '○病児・病後児保育事業', 'raw': '○病児・病後児保育事業', 'start': 36582}, {'name': '障害児保育事業', 'raw': '障害児保育事業', 'start': 36595}, {'name': '保育所運営事業', 'raw': '保育所運営事業', 'start': 36799}, {'name': '妊婦相談事業', 'raw': '妊婦相談事業', 'start': 43702}, {'name': '特例交付金事業', 'raw': '特例交付金事業', 'start': 44061}, {'name': '予防接種事業', 'raw': '予防接種事業', 'start': 44299}, {'name': '計画策定事業', 'raw': '計画策定事業', 'start': 44991}, {'name': '健康教育事業', 'raw': '健康教育事業', 'start': 45229}, {'name': '後期高齢者健康診査事業', 'raw': '後期高齢者 健康\n診査事業', 'start': 46185}, {'name': '食育推進事業', 'raw': '食育推進事業', 'start': 46400}, {'name': 'がん検診事業', 'raw': 'がん検診事業', 'start': 46891}, {'name': '花とみどりのふるさとづくり事業', 'raw': '花とみどりのふる\nさとづくり事業', 'start': 47791}, {'name': 'フラワー街道事業', 'raw': 'フラワー街道事業', 'start': 48160}, {'name': 'プランター植栽事業', 'raw': 'プランター植栽事業', 'start': 48215}, {'name': '花いっぱい運動用苗配布事業', 'raw': '花いっぱい運動用苗配布事業', 'start': 48247}, {'name': '海岸漂着物地域対策推進事業', 'raw': '海岸漂着物地域対\n策推進事業', 'start': 48262}, {'name': '各団体における再資源化物の回収の推進を図り、市民の分別リサイクル意識の啓発に伴うごみの減量化を行った。再資源化推進交付金', 'raw': '各団体における再資源化物の回収の推進を図り、市民の分\n別リサイクル意識の啓発に伴うごみの減量化を行った。\n再資源化推進交付金', 'start': 48660}, {'name': '浄化槽設置整備事業', 'raw': '浄化槽設置整備\n事業', 'start': 49361}, {'name': 'ンター支援事業', 'raw': 'ンター支援事業', 'start': 50585}, {'name': '償制度推進事業', 'raw': '償制度推進事業', 'start': 59065}, {'name': '計画更新事業', 'raw': '計画更新事業', 'start': 59427}, {'name': '県北地域有害鳥獣被害防止対策協議会負担金', 'raw': '県北地域有害鳥獣被害防止対策協議会負担金', 'start': 60788}, {'name': 'ーター設置事業', 'raw': 'ーター設置事業', 'start': 61916}, {'name': '新規就農総合支援事業', 'raw': '新規就農総合支援\n事業', 'start': 62151}, {'name': '家畜導入事業', 'raw': '家畜導入事業', 'start': 63132}, {'name': 'ひらどモー！モー！増頭支援事業補助金', 'raw': 'ひらどモー！モー！増頭支援事業補助金', 'start': 63331}, {'name': '和牛オリンピック対策奨励事業', 'raw': '和牛オリンピック\n対策奨励事業', 'start': 63403}, {'name': '強化対策事業', 'raw': '強化対策事業', 'start': 63854}, {'name': '・全国和牛能力共進会長崎県大会負担金', 'raw': '・全国和牛能力共進会長崎県大会負担金', 'start': 63935}, {'name': '・県北地域和牛改良推進協議会負担金', 'raw': '・県北地域和牛改良推進協議会負担金', 'start': 63964}, {'name': '・和牛オリンピック対策奨励事業補助金', 'raw': '・和牛オリンピック対策奨励事業補助金', 'start': 63992}, {'name': '画書作成、測量・設計及び対策工事にかかる県工事負担金', 'raw': '画書作成、測量・設計及び対策工事にかかる県工事負担金', 'start': 64990}, {'name': 'かかる県工事負担金', 'raw': 'かかる県工事負担金', 'start': 65469}, {'name': '自然災害防止事業', 'raw': '自然災害防止事業', 'start': 66118}, {'name': 'かかる県工事負担金', 'raw': 'かかる県工事負担金', 'start': 66170}, {'name': 'び排水路整備のための測量設計にかかる県工事負担金', 'raw': 'び排水路整備のための測量設計にかかる県工事負担金', 'start': 66459}, {'name': '林道環境整備事業', 'raw': '林道環境整備事業', 'start': 67274}, {'name': '及び対策工事にかかる県工事負担金', 'raw': '及び対策工事にかかる県工事負担金', 'start': 67819}, {'name': '自然災害防止事業', 'raw': '自然災害防止事業', 'start': 68379}, {'name': '支援交付金事業', 'raw': '支援交付金事業', 'start': 68911}, {'name': 'ＦＲＰ漁船廃船処理対策事業', 'raw': 'ＦＲＰ漁船廃船処\n理対策事業', 'start': 69915}, {'name': '豊かな海づくり事業', 'raw': '豊かな海づくり事\n業', 'start': 71375}, {'name': '総事業費県費負担金', 'raw': '総事業費\n県費\n負担金', 'start': 72472}, {'name': '漁業担い手確保推進事業補助金', 'raw': '漁業担い手確保推進事業補助金', 'start': 75357}, {'name': '・ソフト事業', 'raw': '・ソフト事業', 'start': 75904}, {'name': '中小企業振興対策事業', 'raw': '中小企業振興対策\n事業', 'start': 85461}, {'name': 'ンド確立支援事業', 'raw': 'ンド確立支援事業', 'start': 87363}, {'name': '開催支援事業', 'raw': '開催支援事業', 'start': 88269}, {'name': 'まちなか活性化基本計画とは、「長崎県まちなか活性化推進事業', 'raw': 'まちなか活性化基本計画とは、「長崎県まちなか活性化推進事業', 'start': 89359}, {'name': '本計画策定事業', 'raw': '本計画策定事業', 'start': 89390}, {'name': '企業誘致対策事業', 'raw': '企業誘致対策事業', 'start': 89773}, {'name': '観光バス運行事業', 'raw': '観光バス運行事業', 'start': 90204}, {'name': '観光セールス事業', 'raw': '観光セールス事業', 'start': 90869}, {'name': '鄭成功生家再現整備事業', 'raw': '鄭成功生家再現整\n備事業', 'start': 91196}, {'name': '平戸城耐震診断事業', 'raw': '平戸城耐震診断事\n業', 'start': 91735}, {'name': '観光ガイド育成事業', 'raw': '観光ガイド育成事\n業', 'start': 92516}, {'name': 'デル施設創出事業', 'raw': 'デル施設創出事業', 'start': 93476}, {'name': '体験型観光推進事業', 'raw': '体験型観光推進事\n業', 'start': 93842}, {'name': '・平戸キリシタン紀行事業', 'raw': '・平戸キリシタン紀行事業', 'start': 96466}, {'name': 'プロモーション事業', 'raw': 'プロモーション事\n業', 'start': 96840}, {'name': '光圏推進事業', 'raw': '光圏推進事業', 'start': 98829}, {'name': '平戸港夏まつり開催補助金', 'raw': '平戸港夏まつり開催補助金', 'start': 102031}, {'name': '道路単独改良事業', 'raw': '道路単独改良事業', 'start': 106740}, {'name': '急傾斜地崩壊対策事業', 'raw': '急傾斜地崩壊対策\n事業', 'start': 109370}, {'name': '事業県工事負担金', 'raw': '事業県工事負担金', 'start': 109921}, {'name': '河川改良事業', 'raw': '河川改良事業', 'start': 110044}, {'name': '診断を行うための費用の一部を助成し、地震による人的・経済的被害の軽減を図った。・建築物耐震化事業補助金', 'raw': '診断を行うための費用の一部を助成し、地震による人的・経済的被害\nの軽減を図った。\n・建築物耐震化事業補助金', 'start': 114671}, {'name': 'づくり支援事業', 'raw': 'づくり支援事業', 'start': 114790}, {'name': '火災予防推進事業', 'raw': '火災予防推進事業', 'start': 118075}, {'name': '奨学資金貸付事業', 'raw': '奨学資金貸付事業', 'start': 127134}, {'name': '就学対策事業', 'raw': '就学対策事業', 'start': 128223}, {'name': '遠距離等児童・生徒通学費補助金', 'raw': '遠距離等児童・生徒通学費補助金', 'start': 128482}, {'name': '児童・生徒通学費助成金', 'raw': '児童・生徒通学費助成金', 'start': 128610}, {'name': '規模改造事業', 'raw': '規模改造事業', 'start': 131381}, {'name': '空き校舎活用事業', 'raw': '空き校舎活用事業', 'start': 133614}, {'name': '生涯学習推進事業', 'raw': '生涯学習推進事業', 'start': 135344}, {'name': '日本の宝「しま」体感交流事業補助金', 'raw': '日本の宝「しま」体感交流事業補助金', 'start': 136520}, {'name': '空き校舎活用事業', 'raw': '空き校舎活用事業', 'start': 137099}, {'name': '読書推進事業', 'raw': '読書推進事業', 'start': 139056}, {'name': '図書購入事業', 'raw': '図書購入事業', 'start': 140044}, {'name': '（仮称）整備事業', 'raw': '（仮称）整備事業', 'start': 140608}, {'name': '｢平戸学｣推進事業', 'raw': '｢平戸学｣推進事業', 'start': 141202}, {'name': '・伝統的建造物群保存修理事業', 'raw': '・伝統的建造物群保存修理事業', 'start': 141967}, {'name': '平井家住宅修理補助金', 'raw': '平井家住宅修理補助金', 'start': 142183}, {'name': '丸田家住宅修理補助金', 'raw': '丸田家住宅修理補助金', 'start': 142234}, {'name': '・伝統的建造物群防災施設等事業', 'raw': '・伝統的建造物群防災施設等事業', 'start': 142270}, {'name': '・史跡維持管理事業', 'raw': '・史跡維持管理事業', 'start': 142539}, {'name': '・ハクモクレン整備事業', 'raw': '・ハクモクレン整備事業', 'start': 142588}, {'name': '各種開発及び範囲確認に伴う埋蔵文化財発掘調査を実施した。また、里田原遺跡出土の木製品の保存処理を行った。・発掘調査事業', 'raw': '各種開発及び範囲確認に伴う埋蔵文化財発掘調査を実施した。ま\nた、里田原遺跡出土の木製品の保存処理を行った。\n・発掘調査事業', 'start': 142855}, {'name': '・出土遺物保存処理委託事業', 'raw': '・出土遺物保存処理委託事業', 'start': 143029}, {'name': '田中家住宅修理補助金', 'raw': '田中家住宅修理補助金', 'start': 143329}, {'name': '保存整備事業', 'raw': '保存整備事業', 'start': 143681}, {'name': '・修理修景事業', 'raw': '・修理修景事業', 'start': 144013}, {'name': 'また、建築材と考えられる鉄釘も検出することができた。・発掘調査事業', 'raw': 'また、建築材と考えられる鉄釘も検出することができた。\n・発掘調査事業', 'start': 144457}, {'name': '発掘調査事業', 'raw': '発掘調査事業', 'start': 144523}, {'name': '・出土遺物保存処理委託事業', 'raw': '・出土遺物保存処理委託事業', 'start': 144952}, {'name': '・空中写真撮影委託事業', 'raw': '・空中写真撮影委託事業', 'start': 144975}, {'name': '・遺構実測委託事業', 'raw': '・遺構実測委託事業', 'start': 144996}, {'name': '和蘭商館復元整備事業', 'raw': '和蘭商館復元整備\n事業', 'start': 145055}, {'name': '世界遺産登録推進事業', 'raw': '世界遺産登録推進\n事業', 'start': 145525}, {'name': '発グッズ作成を行った。・世界遺産登録推進負担金', 'raw': '発グッズ作成を行った。\n・世界遺産登録推進負担金', 'start': 145852}, {'name': '・世界遺産登録に係る調査事業', 'raw': '・世界遺産登録に係る調査事業', 'start': 145888}, {'name': '民俗芸能公開事業', 'raw': '民俗芸能公開事業', 'start': 145965}, {'name': '文化公演開催事業', 'raw': '文化公演開催事業', 'start': 146515}, {'name': '・次代を担う子どもの文化芸術体験事業', 'raw': '・次代を担う子どもの文化芸術体験事業', 'start': 146755}, {'name': '研修会等参加事業', 'raw': '研修会等参加事業', 'start': 148905}, {'name': '市長特認事業', 'raw': '市長特認事業', 'start': 148926}, {'name': '県民体育大会参加事業', 'raw': '県民体育大会参加事業', 'start': 148946}, {'name': 'スポーツ交流事業', 'raw': 'スポーツ交流事業', 'start': 149056}, {'name': 'スポーツ推進事業', 'raw': 'スポーツ推進事業', 'start': 149902}, {'name': '行委員会運営事業', 'raw': '行委員会運営事業', 'start': 150758}, {'name': 'センター整備事業', 'raw': 'センター整備事業', 'start': 151644}, {'name': '生月町国民体育館耐震診断事業', 'raw': '生月町国民体育館\n耐震診断事業', 'start': 151970}, {'name': '給食共同調理場設備整備事業', 'raw': '給食共同調理場設\n備整備事業', 'start': 152108}, {'name': '農地等災害復旧事業', 'raw': '農地等災害復旧事\n業', 'start': 152738}, {'name': '漁港施設災害復旧事業', 'raw': '漁港施設災害復旧\n事業', 'start': 153357}, {'name': '高齢者生きがいづくりサポート事業', 'raw': '高齢者生きがいづくりサポート事業', 'start': 156464}, {'name': '農業振興地域整備計画更新事業', 'raw': '農業振興地域整備計画更新事業', 'start': 156554}, {'name': '担い手コーディネーター設置事業', 'raw': '担い手コーディネーター設置事業', 'start': 156602}, {'name': '林道環境整備事業', 'raw': '林道環境整備事業', 'start': 156648}, {'name': '別紙雇用対策事業', 'raw': '別紙 雇用対策事業', 'start': 156991}]
accepted=[3,4,9,11,12,13,14,15,16,20,21,27,36,40,49,50,52,54,55,56,57,58,62,64,70,71,73,83,87,88,92,97,98,99,100,101,102,104,109,110,112,115,116,117,121,122,125,126,128,145,146,149,150,156,159,160,161,162,163,164,165]
for n in accepted:
 x=rs[n];row(c,t,x['name'],x['raw'],start=x['start'],note='平成24年度主要施策成果報告で、独立した印字事業名と同頁の事業欄を確認。親事業の補助内訳・施設数・工事件数は事業に分割しない。年度別金額は未入力。')
# Subactivities and account summaries are reviewed but never counted as new projects.
for n in [0,1,2,7,17,18,19,22,23,24,25,28,29,30,31,32,33,34,35,43,44,45,46,47,48,59,60,61,63,68,72,75,76,77,78,79,80,81,82,84,85,89,90,91,95,105,108,113,118,119,123,124,129,130,131,132,133,134,135,136,137,139,140,141,142,143,144,147,148,151,152,153,154,155,166,167]:
 x=rs[n];c['holds'].append(dict(start=len(t[:x['start']].encode('utf-16-le'))//2,raw=x['raw'],reason='Account overview, narrative, parent-project component, subsidy recipient or repeated title; an independent annual business identity is not established. Do not convert subactivities/expenses into extra projects.'))



# Individually reviewed remaining complete titles, with no financial inference.
for x in [{'sourceId': 'bf14284043f1216d18ae4d1d', 'name': 'ふるさとづくり寄附金返礼業務委託料', 'raw': 'ふるさとづくり寄附金返\n礼業務委託料', 'start': 6767}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'name': 'ふるさと納税寄附受付等業務委託料', 'raw': 'ふるさと納税寄附受付等\n業務委託料', 'start': 6949}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'name': 'ごみ散乱防止パトロール業務委託料', 'raw': 'ごみ散乱防止パトロール\n業務委託料', 'start': 15161}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'name': '地域活動支援センター委託料', 'raw': '地域活動支援センター委\n託料', 'start': 23050}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'name': '五島産品島外販売促進業務委託料', 'raw': '五島産品島外販売促進業\n務委託料', 'start': 38440}, {'sourceId': 'bf27718351b3efd1ba4a9126', 'name': '特定個人情報提供等関連事務委任交付金', 'raw': '特定個人情報提供等関\n連事務委任交付金', 'start': 16131}, {'sourceId': 'bf27718351b3efd1ba4a9126', 'name': '収入資産、扶養義務調査等充実事業', 'raw': '収入資産、扶養義務調\n査等充実事業', 'start': 53008}, {'sourceId': 'bf27718351b3efd1ba4a9126', 'name': '医療扶助適正実施推進事業', 'raw': '医療扶助適正実施推進\n事業', 'start': 53360}, {'sourceId': 'bf27718351b3efd1ba4a9126', 'name': '地域の絆再生事業交付金', 'raw': '地域の絆再生事業交付\n金', 'start': 122966}, {'sourceId': 'bf27718351b3efd1ba4a9126', 'name': '森林整備地域活動支援交付金', 'raw': '森林整備地域活動支援\n交付金', 'start': 169627}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'name': '医療扶助適正実施推進事業', 'raw': '医療扶助適正実施推進事業', 'start': 45054}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'name': '森林整備地域活動支援交付金', 'raw': '森林整備地域活動支援交付\n金', 'start': 107434}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'name': '森林整備地域活動支援交付金', 'raw': '森林整備地域活動支援交付\n金', 'start': 109872}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'name': '森林整備地域活動支援交付金', 'raw': '森林整備地域活動支援交付\n金', 'start': 99314}, {'sourceId': '138839955fa27c73a8b625c6', 'name': '森林整備地域活動支援交付金', 'raw': '森林整備地\n域活動支援\n交付金', 'start': 10154}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '自死遺族支援業務委託料', 'start': 30239, 'name': '自死遺族支援業務委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '医療廃棄物処理委託料', 'start': 30524, 'name': '医療廃棄物処理委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': 'レントゲン撮影委託料', 'start': 32330, 'name': 'レントゲン撮影委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '肝炎ウイルス検診委託料', 'start': 32549, 'name': '肝炎ウイルス検診委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': 'デマンド監視委託料', 'start': 47122, 'name': 'デマンド監視委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '雇用充足促進業務委託料', 'start': 47423, 'name': '雇用充足促進業務委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '救急活動支援業務委託料', 'start': 61204, 'name': '救急活動支援業務委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '電話通訳業務委託料', 'start': 61742, 'name': '電話通訳業務委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '給食調理業務等委託料', 'start': 66104, 'name': '給食調理業務等委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '工事監査業務委託料', 'start': 67643, 'name': '工事監査業務委託料'}, {'sourceId': 'bf14284043f1216d18ae4d1d', 'raw': '監査等支援業務委託料', 'start': 67663, 'name': '監査等支援業務委託料'}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '市民体育大会事業費補助金', 'start': 146913, 'name': '市民体育大会事業費補助金'}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '県民体育大会参加費補助金', 'start': 147109, 'name': '県民体育大会参加費補助金'}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '競技団体強化事業費補助金', 'start': 147778, 'name': '競技団体強化事業費補助金'}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': 'Ｂ＆Ｇ体育行事補助金', 'start': 148099, 'name': 'Ｂ＆Ｇ体育行事補助金'}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '市民体育大会事業費補助金', 'start': 170342, 'name': '市民体育大会事業費補助金'}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '県民体育大会参加費補助金', 'start': 157579, 'name': '県民体育大会参加費補助金'}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': 'スポーツ少年団運営費補助金', 'start': 157706, 'name': 'スポーツ少年団運営費補助金'}, {'sourceId': '5ae3c35511a9e71c34e41a2c', 'raw': '雇用充足促進業務委託料', 'start': 4576, 'name': '雇用充足促進業務委託料'}]:
 c=next(c for c in configs if c['sourceId']==x['sourceId']);t=verified_text(c['sourceId'],'42211');name=x['name'];matches=[r for r in c['rows'] if alias_key(r['name'])==alias_key(name)]
 if matches:
  hold(c,t,x['raw'],'Possible spelling or subsidy alias of '+matches[0]['name']+'; no automatic merge or additional record.');continue
 row(c,t,name,x['raw'],start=x['start'],note='同一年度の名称欄で継続した印字タイトルを確認。混在する担当課・単なる事業説明・道路工事内訳を名称にしない。費用・指標は未抽出。')


for x in [{'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': 'プレミアム付商品券発行事業費補助金', 'start': 124860}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '市体育協会事業費補助金', 'start': 146233}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '体育スポーツ振興補助金', 'start': 146384}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': 'スポーツ推進委員事業', 'start': 148212}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '体育館管理運営事業', 'start': 149288}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '福江武道館大規模改修事業', 'start': 149452}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '常備消防自動車整備事業', 'start': 157890}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': '小型動力ポンプ購入事業', 'start': 158105}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': 'モンパルナス構想推進事業', 'start': 193913}, {'sourceId': 'b909ef57d1d483e7bb1a960b', 'raw': 'あじ祭り開催事業', 'start': 194292}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '常備消防自動車整備事業', 'start': 150059}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '小型動力ポンプ購入事業', 'start': 150618}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '市体育協会事業費補助金', 'start': 170518}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '体育スポーツ振興補助金', 'start': 170647}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': 'コミュニティー助成事業', 'start': 171089}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': 'スポーツ推進委員事業', 'start': 172223}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '長崎国体開催事業', 'start': 174696}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': '多郎島地区景観整備事業', 'start': 183524}, {'sourceId': 'e10e5f99515d7b20a94a49d3', 'raw': 'モンパルナス構想推進事業', 'start': 190820}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '情報系パソコン一括導入事業', 'start': 18893}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '常備消防自動車整備事業', 'start': 136097}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '小型動力ポンプ購入事業', 'start': 136667}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '消防救急無線デジタル化事業', 'start': 138304}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '消防署出張所庁舎建設事業', 'start': 138872}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '防災行政無線整備事業', 'start': 138972}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '市体育協会事業費補助金', 'start': 157283}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '体育スポーツ振興補助金', 'start': 157432}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': 'スポーツ推進委員事業', 'start': 157824}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '長崎国体開催事業', 'start': 159066}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': '多郎島地区景観整備事業', 'start': 169375}, {'sourceId': 'f4df0a926e3fcc88af7357bb', 'raw': 'モンパルナス構想事業', 'start': 174965}]:
 c=next(c for c in configs if c['sourceId']==x['sourceId']);t=verified_text(c['sourceId'],'42211');name=x['raw'];matches=[r for r in c['rows'] if r['name'].startswith(name) or alias_key(r['name'])==alias_key(name)]
 if matches:continue
 row(c,t,name,x['raw'],start=x['start'],note='担当課列に挟まれた印字事業名を個別照合。評価年度のみを保持し、実施年度・計画の完了・決算額を推定しない。名称に内訳・受益者を混ぜない。')


c=next(c for c in configs if c['sourceId']=='7debebb80c1bb074651a0ac6');t=verified_text(c['sourceId'],'42207')
hiradoRepairs=[{'name': '平戸市振興公社公益法人移行事業', 'raw': '益法人移行事業', 'start': 7699, 'prefix': '平戸市振興公社公'}, {'name': '協働によるまちづくり推進事業', 'raw': 'くり推進事業', 'start': 10022, 'prefix': '協働によるまちづ'}, {'name': '地域の元気づくり支援交付金事業', 'raw': '支援交付金事業', 'start': 10798, 'prefix': '地域の元気づくり'}, {'name': '「やらんば！平戸」応援基金プロジェクト事業', 'raw': 'ジェクト事業', 'start': 11950, 'prefix': '「やらんば！平'}, {'name': '心身障害者福祉タクシー助成事業', 'raw': 'クシー助成事業', 'start': 26291, 'prefix': '心身障害者福祉タ'}, {'name': '放課後児童クラブ運営支援事業', 'raw': '運営支援事業', 'start': 33965, 'prefix': '放課後児童クラブ'}, {'name': '子宮頸がん等ワクチン接種緊急促進臨時特例交付金事業', 'raw': '特例交付金事業', 'start': 44061, 'prefix': '子宮頸がん等'}, {'name': 'いきいき平戸21計画策定事業', 'raw': '計画策定事業', 'start': 44991, 'prefix': 'いきいき平戸 21'}, {'name': '農業者戸別所得補償制度推進事業', 'raw': '償制度推進事業', 'start': 59065, 'prefix': '農業者戸別所得補'}, {'name': '21世紀平戸牛産地強化対策事業', 'raw': '強化対策事業', 'start': 63854, 'prefix': '21 世紀平戸牛産地'}, {'name': '森林整備地域活動支援交付金事業', 'raw': '支援交付金事業', 'start': 68911, 'prefix': '森林整備地域活動'}, {'name': '「平戸あご」ブランド確立支援事業', 'raw': 'ンド確立支援事業', 'start': 87363, 'prefix': '「平戸あご」ブラ'}, {'name': '物産振興イベント開催支援事業', 'raw': '開催支援事業', 'start': 88269, 'prefix': '物産振興イベント'}, {'name': 'まちなか活性化基本計画策定事業', 'raw': '本計画策定事業', 'start': 89390, 'prefix': 'まちなか活性化基'}, {'name': '“おもてなし”モデル施設創出事業', 'raw': 'デル施設創出事業', 'start': 93476, 'prefix': '“おもてなし”モ'}, {'name': '平戸・佐世保・西海ロングステイ観光圏推進事業', 'raw': '光圏推進事業', 'start': 98829, 'prefix': '平戸・佐世保・西'}, {'name': '急傾斜地崩壊対策事業県工事負担金', 'raw': '事業県工事負担金', 'start': 109921, 'prefix': '急傾斜地崩壊対策'}, {'name': '耐震・安心住まいづくり支援事業', 'raw': 'づくり支援事業', 'start': 114790, 'prefix': '耐震・安心住まい'}, {'name': '平戸小学校校舎大規模改造事業', 'raw': '規模改造事業', 'start': 131381, 'prefix': '平戸小学校校舎大'}, {'name': '総合情報センター（仮称）整備事業', 'raw': '（仮称）整備事業', 'start': 140608, 'prefix': '総合情報センター'}, {'name': '国指定重要文化財保存整備事業', 'raw': '保存整備事業', 'start': 143681, 'prefix': '国指定重要文化財'}, {'name': '全国高等学校総合体育大会平戸市実行委員会運営事業', 'raw': '行委員会運営事業', 'start': 150758, 'prefix': '全国高等学校総合'}, {'name': '生月町勤労者体育センター整備事業', 'raw': 'センター整備事業', 'start': 151644, 'prefix': '生月町勤労者体育'}]
for x in hiradoRepairs:
 lo=x['start'] if x['name']=='急傾斜地崩壊対策事業県工事負担金' else max(0,x['start']-400);hi=min(len(t),x['start']+len(x['raw'])+400);hits=list(re.finditer(r'(?m)^'+re.escape(x['prefix'])+r'$',t[lo:hi]));assert len(hits)==1,(x['name'],len(hits));a=lo+hits[0].start();start=min(a,x['start']);end=max(a+len(x['prefix']),x['start']+len(x['raw']));row(c,t,x['name'],t[start:end],start=start,note='FY2012決算報告の同一頁にある名称前後片を個別照合し、間に混在した説明・財源列を証拠引用に残した。金額・工事内訳は推定しない。')


for x in [{'name': '身体障害者交通船旅客運賃助成事業', 'start': 26340, 'raw': '旅客運賃助成事業\n（福祉課）\n【事項別明細書 144 頁】\n\n車椅子常用者 29 人（述べ 471 件）\n\n（福祉課）\n【事項別明細書 144 頁】\n【事項別明細書 158 頁】\n\n5 人（延べ 86 件）\n\n39 千円\n\n視覚障害者\n\n12 人（延べ 247 件）\n\n106 千円\n\n祉事業\n（福祉課）\n【事項別明細書 144 頁】\n【事項別明細書 146 頁】\n\n3款\n\n民生費\n\nそ の 他\n\n339\n\n一般財源\n\n339\n\n障害者の社会活動の範囲が広がり、障害者の福祉向上に寄与\nすることができた。\n\n25 千円\n\n第２種身体障害者手帳所持者に対し、社会参加とその軽減を図るた\n\n611\n\n611\n\n障害者の社会参加が促進された。\n\nめ交通船旅客運賃の４割助成を行った。\n大島～平戸\n\n29 人（延べ 1,388 件）\n\n度島～平戸\n\n4 人（延べ 283 件）\n\n356 千円\n70 千円\n186 千円\n\n福祉の増進及び負担軽減のため、心身障害者、乳幼児、母子家庭等\n\n158,500\n\n70,149\n\n5\n\n○扶助費\n\n＜29,842 千円＞\n\n母子家庭等\n\n＜11,236 千円＞\n\n障害 1･2 級\n\n心身機能の障害で日常生活に支障がある者、乳幼児、母子家\n\n○支給件数の推移\n\n153,892 千円\n\n乳幼児\n\n88,346\n\n庭等の経済的負担の軽減ができた。\n\nにおける母と子及び寡婦等に対して、医療費の助成を行った。\n\n(単位：件)\n22 年度\n\n23 年度\n\n24 年度\n\n乳 幼 児\n\n13,653\n\n23,688\n\n22,708\n\n＜39,609 千円＞\n\n母子家庭等\n\n3,441\n\n4,261\n\n4,032\n\n療育Ａ1･2\n\n＜ 7,719 千円＞\n\n障害１・２\n\n6,459\n\n6,701\n\n6,806\n\n老人\n\n＜36,871 千円＞\n\n療育 A１・２\n\n2,116\n\n2,068\n\n1,833\n\n障害 3 級\n\n＜ 9,199 千円＞\n\n老\n\n人\n\n6,844\n\n6,706\n\n6,250\n\n療育Ｂ1\n\n＜ 2,537 千円＞\n\n障 害 ３\n\n1,893\n\n2,248\n\n2,344\n\n単独(障害 4 級･療育Ｂ2･老人 3･4 級Ｂ1) ＜16,879 千円＞\n\n療育Ｂ１\n\n924\n\n875\n\n913\n\n○事務費\n\nひらどふれあい福\n\n地 方 債\n\n169 千円\n\n知的障害者\n\n事務費\n\n福祉医療給付事業\n\n訳\n\nを利用する場合、基本料金の９割助成を行った。\n\n事務費\n身体障害者交通船', 'oldStart': 26340}, {'name': 'ひらどふれあい福祉事業', 'start': 26483, 'raw': '祉事業\n（福祉課）\n【事項別明細書 144 頁】\n【事項別明細書 146 頁】\n\n3款\n\n民生費\n\nそ の 他\n\n339\n\n一般財源\n\n339\n\n障害者の社会活動の範囲が広がり、障害者の福祉向上に寄与\nすることができた。\n\n25 千円\n\n第２種身体障害者手帳所持者に対し、社会参加とその軽減を図るた\n\n611\n\n611\n\n障害者の社会参加が促進された。\n\nめ交通船旅客運賃の４割助成を行った。\n大島～平戸\n\n29 人（延べ 1,388 件）\n\n度島～平戸\n\n4 人（延べ 283 件）\n\n356 千円\n70 千円\n186 千円\n\n福祉の増進及び負担軽減のため、心身障害者、乳幼児、母子家庭等\n\n158,500\n\n70,149\n\n5\n\n○扶助費\n\n＜29,842 千円＞\n\n母子家庭等\n\n＜11,236 千円＞\n\n障害 1･2 級\n\n心身機能の障害で日常生活に支障がある者、乳幼児、母子家\n\n○支給件数の推移\n\n153,892 千円\n\n乳幼児\n\n88,346\n\n庭等の経済的負担の軽減ができた。\n\nにおける母と子及び寡婦等に対して、医療費の助成を行った。\n\n(単位：件)\n22 年度\n\n23 年度\n\n24 年度\n\n乳 幼 児\n\n13,653\n\n23,688\n\n22,708\n\n＜39,609 千円＞\n\n母子家庭等\n\n3,441\n\n4,261\n\n4,032\n\n療育Ａ1･2\n\n＜ 7,719 千円＞\n\n障害１・２\n\n6,459\n\n6,701\n\n6,806\n\n老人\n\n＜36,871 千円＞\n\n療育 A１・２\n\n2,116\n\n2,068\n\n1,833\n\n障害 3 級\n\n＜ 9,199 千円＞\n\n老\n\n人\n\n6,844\n\n6,706\n\n6,250\n\n療育Ｂ1\n\n＜ 2,537 千円＞\n\n障 害 ３\n\n1,893\n\n2,248\n\n2,344\n\n単独(障害 4 級･療育Ｂ2･老人 3･4 級Ｂ1) ＜16,879 千円＞\n\n療育Ｂ１\n\n924\n\n875\n\n913\n\n○事務費\n\nひらどふれあい福', 'oldStart': 26483}, {'name': '在宅寝たきり高齢者等介護見舞金支給事業', 'start': 31917, 'raw': '給事業\n（長寿保険課）\n【事項別明細書 152 頁】\n\n民生費\n\n緊急時の迅速な対応や安否確認、また、普段の生活の心配事、\n対象者が安心して在宅生活を送ることができた。\n\n貸与台数 392 台 (平成 25 年 3 月末現在)\n（内訳）平戸 217 台 生月 43 台 田平 88 台 大島 44 台\n\n社会的孤立感の解消、自立生活の助長を図るため、在宅のひとり暮\nビス等を実施した。\n\n者等介護見舞金支\n\n5,765\n\n悩み事の相談に応じるなど、日常生活を支援することにより、\n\n（長寿保険課）\n\n在宅寝たきり高齢', 'oldStart': 31917}, {'name': '高齢者・障害者住宅改造助成事業', 'start': 32609, 'raw': '改造助成事業\n（長寿保険課）\n【事項別明細書 152 頁】\n\n度島いきいきプラ\nザ（仮称）整備事業\n（長寿保険課）\n【事項別明細書 152 頁】\n\n老人保護措置事業\n（福祉課）\n【事項別明細書 154 頁】\n\n高齢者（要介護者及び要支援者）または重度障害者の日常生活を容\n\n1,303\n\n地 方 債\n\nそ の 他\n\n651\n\n一般財源\n\n652\n\n高齢者及び障害者の日常生活を容易にし、介護者や家族の負\n担を軽減するとともに、安心して快適に自立した生活を送るこ\n\n成を行った。\n\nとができる環境整備を行った。\n\n高齢者 15 件\n\n1,303 千円\n\n昭和 56 年以前に建設された度島診療所及び医師住宅の建設に併せ、\n\n2,519\n\n2,500\n\n19\n\n介護予防施設を併設するための地質調査、設計委託を行った。\n地質調査業務委託\n設計業務委託\n\n施設建設に伴い、医療供給体制の充実と福祉・介護サービス\nの提供を行うことで、医療・福祉・介護の連携が可能となる。\n\n350 千円\n2,168 千円\n\n概ね 65 歳以上の老人で、環境上及び経済的理由のため、在宅生活\n\n200,283\n\n27,758\n\n172,525\n\n入所者本人や家族の不安解消と、生活安定の支援を行った。\n\nが困難な者を対象に、養護老人ホームに入所させ養護した。\n○入所者の状況（平成 25 年 3 月末現在）\n施 設 名\nの\n\n入所人員\n\n園\n\n50 名\n\nし か ま ち\n\n27 名\n\nグリーンホーム\n\n6名\n\nソ レ イ ユ\n\n2名\n\n恵\n\n2名\n\nの\n\n丘\n\n光\n\n明\n\n荘\n\n1名\n\n湧\n\n泉\n\n荘\n\n1名\n\n合\n\n後期 高 齢者 医療\n\n訳\n\n易にし、介護者の負担を軽減するため、高齢者等の住宅改造に対し助\n\n光\n\n療養給付事業\n\n内\n\n事 業 の 成 果\n国県支出金\n\n高齢者・障害者住宅', 'oldStart': 32609}, {'name': 'コンベンション開催事業', 'start': 94244, 'raw': '催事業\n（観光課）\n【事項別明細書 244 頁】\n\n観光客の誘致と地域の経済効果を創出するため、コンベンション\n\n○にぎわいづくり実績\n\n事業\n（観光課）\n\n2,800\n\n地域の賑わいにつながるコンベンションの開催に対して支\n致につなげることができた。\n\n補助金額\n\n宿泊実績\n\n50\n\n149\n\n1,000\n\n6,954\n\n150\n\n365\n\n佐世保西高等学校３年夏合宿\n\n500\n\n1,353\n\n佐世保西高等学校１年夏合宿\n\n250\n\n921\n\n青山学院初等部夏合宿５年生\n\n250\n\n810\n\n香雲堂吟詠会・来吟知会創立 10 周年\n\n200\n\n252\n\nとびうお杯小学生バレーボール親善大会\n\n100\n\n209\n\n商工会女性部主張発表長崎県大会\n\n50\n\n186\n\nVVSB Cup in Hirado 2012 サッカー大会\n\n150\n\n360\n\n脇川ﾎﾃﾙｶｯﾌﾟﾌﾚｯｼｭｻｯｶｰ U10 大会\n\n25\n\n63\n\n150\n\n320\n\n25\n\n86\n\n2,900\n\n12,028\n\n計\n\nマスメディアＰＲ\n\n一般財源\n\n援することにより、地域の活力と魅力を向上させ、観光客の誘\n\n佐世保北中学校学習合宿\n\nソフトバンク杯ＦＭ長崎Ｕ10 キッズサッカ\nーフェスティバル\n久留米大学陸上部・九州大学陸上部合同合\n宿\n\n（観光課）\n\n100\n\nそ の 他\n\n(単位：千円,延べ人数）\n\n英進館夏期特訓合宿中３公立\n\n【事項別明細書 246 頁】\n\n2,900\n\n地 方 債\n\nまた、本年から新たに勉強合宿に対する補助も行った。\n\n鄭成功生誕記念平戸ｻｯｶｰﾌｪｽﾀ U-10 大会\n\n識整備事業\n\n訳\n\nなどを開催する各種団体に対して支援を実施した。\n\n事 業 名\n\n観光案内・誘導標\n\n内\n\n事 業 の 成 果\n国県支出金\n\nコンベンション開', 'oldStart': 94244}, {'name': '県指定文化財保存整備事業', 'start': 144044, 'raw': '整備事業\n（文化遺産課）\n【事項別明細書 330 頁】\n\n882 千円（分担金 264 千円）\n\n坂本邸家屋修理修景\n\n3,319 千円（分担金 996 千円）\n\n村田邸家屋修理修景\n\n2,939 千円（分担金 882 千円）\n\n県指定史跡「鯨組主益冨家居宅跡」の座敷の改修事業、県指定有形\n\n県指定文化財としての保存継承が可能となり、火災等への備\nえを整備することができた。\n\n558\n\n558\n\n国指定史跡地内の整備として、文化財的な判断と、今後の方\n向性を検討することができた。\n\n・第１回整備委員会 12 月 17 日開催\n\n和蘭商館関連施設があったとされる、田平町横島で発掘調査を行\nい、リンバーンと呼ばれる航海用ロープ製作場のものと関連した排水\n\n（文化遺産課）\n\n設備跡や砂岩切石集中区が検出された。\n\n4,734\n\n2,516\n\n2,218\n\n国史跡への追加指定するため、新たな資料を加えることがで\nきた。\n\nまた、建築材と考えられる鉄釘も検出することができた。\n・発掘調査事業\n\n教育費\n\n2,773\n\n整備委員会を県とともに開催した。\n\n発掘調査事業\n\n10 款\n\n2,773\n\n58 千円\n\n「史跡平戸和蘭商館跡」に位置する常灯の鼻は、経年劣化による破\n\n【事項別明細書 332 頁】\n\n修理修景事業では、\n選定地区内家屋４棟で屋根替えなどの\n工事を行い、景観の保全・向上を図ることができた。\n各種イベントを実施したことで、\n地域内の意識高揚につな\nげることができた。\n\n・県指定史跡「鯨組主益冨家居宅跡」 2,715 千円\n・県指定有形文化財「雄香寺開山堂」\n\n損が著しく、\n危険な状態であり、\n修復工事を行う必要があることから、\n\n和蘭商館関連施設\n\n2,360\n\n文化財｢雄香寺開山堂｣の消防設備修繕に対する補助を行った。\n\n事業\n（文化遺産課）\n\n3,433\n\n674 千円\n\n常灯の鼻修復調査\n\n【事項別明細書 332 頁】\n\n13,517\n\n4,303 千円（分担金 1,291 千円）\n\n志田邸倉庫修理修景\n\n・事務事業\n\n県指定文化財保存', 'oldStart': 144044}]:
 row(c,t,x['name'],x['raw'],start=x['start'],note='FY2012同一決算ページの明示された名称片を照合。施設/費用の構成項目は別件にしない。資料の並び順だけから担当や金額を結び付けない。')
 for h in c['holds']:
  if h['start']==x['oldStart']:h.update(status='resolved_title_boundary',reason='Saved literal prefix and suffix reviewed within the same page; full intervening quote retained.')


# Preserve four previously accepted supplemental-source identities/unknown FY.
# The full book offers alternate FY evidence, not permission to replace old fields.
c=next(c for c in configs if c['sourceId']=='bf14284043f1216d18ae4d1d');t=verified_text(c['sourceId'],'42211')
preservePrior={'ふるさとづくり寄附金返礼業務委託料','ふるさと納税寄附受付等業務委託料','地域活動支援センター委託料','五島産品島外販売促進業務委託料'}
for r in c['rows']:
 if r['name'] in preservePrior:
  c['holds'].append(dict(start=r['start'],raw=r['raw'],reason='Same evaluation-year project is already preserved from the supplemental source with unknown execution FY. This full book provides FY2022 evidence, retained as an alternative only: do not replace original ID, quote or fields.'))
c['rows']=[r for r in c['rows'] if r['name'] not in preservePrior]

for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-nagasaki-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const nagasakiRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
