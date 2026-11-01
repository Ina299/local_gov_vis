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

for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-nagasaki-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const nagasakiRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
