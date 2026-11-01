from pathlib import Path
import json,hashlib,re
root=Path(__file__).resolve().parents[4];base=root/'apps/web/public/evaluation-evidence';meta=json.loads((base/'municipalities/40224.json').read_text());out=[]
for id,fy,count in [('b7fdca7d1a5f3f59bc814aeb',2024,84),('e44263b49649b4a3adf0e7b6',2025,105)]:
 s=next(s for s in meta['sources'] if s['id']==id);info=s['text'];assert info['truncated'] and not info.get('continuations');raw=(base/info['assetPath']).read_bytes();assert len(raw)==info['assetBytes'] and hashlib.sha256(raw).hexdigest()==info['assetSha256'];d=json.loads(raw);t=d['text'];assert len(t)==info['exportedCharacters']==120000 and hashlib.sha256(t.encode()).hexdigest()==info['textSha256'];assert d['sourceId']==id and d['sourceUrl']==s['url'] and d['sourceSha256']==s['acquisition']['sourceSha256'] and d['municipalityCode']=='40224'
 proof=t[:t.index('≪')].rstrip();assert proof.startswith('令和'+('６' if fy==2024 else '７')+'年度\n主要施策成果報告書\n（事務事業評価）')
 rows=[];holds=[];ms=list(re.finditer(r'^([^\n]+?)[ \n]単位：円\n大事業 ',t,re.M))
 for j,m in enumerate(ms):
  e=ms[j+1].start() if j+1<len(ms) else len(t);body=t[m.start():e];pm=re.search(r'\n-(\d+)-\s*$',body)
  if j==0:assert pm and int(pm[1])==7;continue # explicitly labelled sample explanation page
  if not pm:holds.append({'name':m[1],'reason':'Final cached sheet is cut before its results, cost breakdown and page footer. No extraction.'});continue
  page=int(pm[1]);assert page==j+7
  required=['事業費の内訳','事業の内容']+(['【事後】課題','【事後】成果','課題に対する改善・改革案'] if fy==2024 else ['事業の目的・背景','事業実施後の成果等'])
  assert all(x in body for x in required),(m[1],required)
  rows.append(dict(name=m[1],start=len(t[:m.start()].encode('utf-16-le'))//2,end=len(t[:e].encode('utf-16-le'))//2,page=page))
 assert len(rows)==count and len(holds)==1
 out.append(dict(sourceId=id,municipalityCode='40224',sourceUrl=s['url'],sourceSha256=d['sourceSha256'],prefixSha256=info['textSha256'],exportedCharacters=120000,originalCharacters=info['characters'],proof=proof,year=fy,rows=rows,holds=holds))
(root/'apps/crawler/src/evaluations/expansion/descending-fukutsu-bounded-map.ts').write_text('// Reviewed complete individual sheets inside pinned incomplete cached prefixes. No full-text hash claim.\nexport const fukutsuBounded = '+json.dumps(out,ensure_ascii=False,indent=2)+';\n')
print([(c['year'],len(c['rows'])) for c in out])
