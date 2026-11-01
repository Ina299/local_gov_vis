import json,re,hashlib,pathlib,unicodedata
specs={
'f52f36a7b89f74bb4b36c809':{2:['各学校での読書活動の推進'],7:['放課後子ども教室'],8:['熟達した教員の授業公開','特別支援教育研修会'],9:['施設の維持補修事業','学校施設維持管理計画策定事業'],10:['大型掲示装置の整備（電子黒板の整備）'],11:['久住学校給食共同調理場運営業務','直入学校給食共同調理場運営業務'],15:['竹田郷土学の推進'],16:['高齢者大学'],17:['人権教育推進指導者養成講座','人権学習学級'],18:['人権教育促進のための講師派遣事業'],20:['中央公民館教室事業'],22:['新歴史資料館建設事業'],23:['第３２回佐藤義美賞竹田童謡作詩コンクール','矢崎節夫氏トークイベント'],25:['総合運動公園多目的広場トイレ改修','トイレ手洗い自動水栓取替工事','グラウンド照明器具落下防止工事'],26:['スポーツ医科学研修講座']},
'bacbcb79d5dc5973075dd25d':{2:['ＩＣＴ活用教育の推進'],5:['竹田郷土学の推進'],7:['生活の決まりの徹底','保護者に連携・協力を求め生活習慣を整える取組'],8:['体力向上１校１実践の取組','体育指導教師の活用及び体育担当者会の開催'],10:['幼児教育の質の向上'],14:['施設の維持補修事業','洋式トイレの整備','教室LEDの照明整備'],16:['竹田中央学校給食共同調理場運営事業','久住学校給食共同調理場運営業務','直入学校給食共同調理場運営業務'],25:['学校の働き方改革の推進'],26:['教職員の健康診断','教職員のストレスチェック'],27:['青少年教育（ジュニアリーダーセミナー）'],28:['高齢者大学'],29:['人権教育推進指導者養成講座','人権学習学級'],30:['人権教育促進のための講師派遣事業'],32:['中央公民館教室事業'],33:['図書館サービスの充実'],34:['全日本高等学校声楽コンクール'],35:['第３３回佐藤義美賞竹田童謡作詩コンクール'],37:['総合運動公園陸上競技場改修','直入B&G海洋センター体育館照明LED化'],38:['第７５回竹田市駅伝競走大会','スポーツ医科学研修講座'],39:['第28回B&G直入カップバレーボール大会','第49回竹田市少年少女駅伝ロードレース大会']}}
configs=[]
for id,entries in specs.items():
 t=json.load(open('apps/web/public/evaluation-evidence/documents/'+id+'.json'))['text'];h=list(re.finditer('２．令和[２３]年度の主な取組',t));rows=[]
 for n,names in entries.items():
  a=h[n].start();b=h[n+1].start()if n+1<len(h)else len(t);raw=t[a:b];assert '３．'in raw,(id,n);raw=raw[:raw.index('３．')]
  for name in names:
   norm=lambda v:''.join(unicodedata.normalize('NFKC',v).split());it=iter(norm(raw));assert all(any(c==v for c in it)for v in norm(name)),(id,n,name)
  rows.append({'sheet':n,'start':len(t[:a].encode('utf-16-le'))//2,'raw':raw,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'names':names})
 configs.append({'sourceId':id,'sourceFullTextSha256':hashlib.sha256(t.encode()).hexdigest(),'rows':rows,'holds':[]})
pathlib.Path('apps/crawler/src/evaluations/expansion/descending-taketa-earlier-map.ts').write_text('export const taketaEarlierReviewed = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n');print([sum(len(r['names'])for r in c['rows'])for c in configs])
