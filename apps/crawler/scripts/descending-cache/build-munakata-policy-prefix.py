from pathlib import Path
import json,hashlib,re
root=Path(__file__).resolve().parents[4];base=root/'apps/web/public/evaluation-evidence';id='cad775d4c7546b1e5fa8ebc2';s=next(s for s in json.loads((base/'municipalities/40220.json').read_text())['sources'] if s['id']==id);info=s['text'];assert info['truncated'] and not info.get('continuations');b=(base/info['assetPath']).read_bytes();assert len(b)==info['assetBytes'] and hashlib.sha256(b).hexdigest()==info['assetSha256'];d=json.loads(b);t=d['text'];assert len(t)==info['exportedCharacters']==120000 and hashlib.sha256(t.encode()).hexdigest()==info['textSha256'];assert d['sourceId']==id and d['sourceSha256']==s['acquisition']['sourceSha256'] and d['sourceUrl']==s['url'] and d['municipalityCode']=='40220'
chunks=list(re.finditer(r'４[．.]+.*?(?=５[．.])',t,re.S));assert len(chunks)==31
names=['医療費適正化事業','医療情報収集事業','ブロック塀等撤去費補助事業','生活支援体制整備事業','空調設備設置事業','むなかた子ども大学事業','地域特産品振興事業','海洋環境保全事業','空き家を活用したお試し移住事業','学校開放事業','保健事業と介護予防の一体的事業','世界水泳への招待事業'];rows=[]
for name in names:
 hit=next(m for m in chunks if name in m[0]);a=t.index(name,hit.start());assert hit[0].startswith('４．令和５年度の現状と課題と主な取り組み状況等')
 rows.append(dict(name=name,nameStart=len(t[:a].encode('utf-16-le'))//2,start=len(t[:hit.start()].encode('utf-16-le'))//2,end=len(t[:hit.end()].encode('utf-16-le'))//2))
c=dict(sourceId=id,municipalityCode='40220',sourceUrl=s['url'],sourceSha256=d['sourceSha256'],prefixSha256=info['textSha256'],exportedCharacters=120000,originalCharacters=info['characters'],year=2023,proof='令和５年度\n施策評価結果\n宗 像 市',rows=rows)
assert t.startswith(c['proof']);(root/'apps/crawler/src/evaluations/expansion/descending-munakata-policy-map.ts').write_text('// Explicit individual names in complete annual implementation sections of a pinned prefix.\nexport const munakataPolicy = '+json.dumps(c,ensure_ascii=False,indent=2)+';\n');print('verified complete policy contexts',len(chunks),'explicit individual proposals',len(rows))
