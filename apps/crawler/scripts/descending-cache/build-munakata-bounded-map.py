from pathlib import Path
import json,hashlib,re
root=Path(__file__).resolve().parents[4];base=root/'apps/web/public/evaluation-evidence';meta=json.loads((base/'municipalities/40220.json').read_text());out=[]
for id,fy,count in [('59df522bf14834b4f9ce577b',2022,90),('7226938569c4ff73940b75f0',2021,86),('f55d2cad1aa84843ebbb6e32',2020,90)]:
 s=next(s for s in meta['sources'] if s['id']==id);info=s['text'];assert info['truncated'] and not info.get('continuations');raw=(base/info['assetPath']).read_bytes();assert len(raw)==info['assetBytes'] and hashlib.sha256(raw).hexdigest()==info['assetSha256'];d=json.loads(raw);t=d['text'];assert len(t)==info['exportedCharacters']==120000 and hashlib.sha256(t.encode()).hexdigest()==info['textSha256'];assert d['sourceId']==id and d['sourceUrl']==s['url'] and d['sourceSha256']==s['acquisition']['sourceSha256'] and d['municipalityCode']=='40220'
 proof=t.splitlines()[0];assert proof=={2022:'令和４年度 決算成果報告書',2021:'令和３年度 決算成果報告書',2020:'令和2年度 決算成果報告書'}[fy]
 ms=list(re.finditer(r'^([^\n]+?) ■事業概要■',t,re.M));assert len(ms)==count;rows=[]
 for j,m in enumerate(ms):
  e=ms[j+1].start() if j+1<len(ms) else t.index('その他の決算額',m.start());body=t[m.start():e];assert len(m[1])<50 and '■実績・成果■' in body and '決算書' in body and '事業費（千円）' in body
  rows.append(dict(name=m[1],start=len(t[:m.start()].encode('utf-16-le'))//2,end=len(t[:e].encode('utf-16-le'))//2))
 out.append(dict(sourceId=id,municipalityCode='40220',sourceUrl=s['url'],sourceSha256=d['sourceSha256'],prefixSha256=info['textSha256'],exportedCharacters=120000,originalCharacters=info['characters'],proof=proof,year=fy,rows=rows))
(root/'apps/crawler/src/evaluations/expansion/descending-munakata-bounded-map.ts').write_text('// Complete named annual result blocks before the cut statistical appendix. No full-book completeness claim.\nexport const munakataBounded = '+json.dumps(out,ensure_ascii=False,indent=2)+';\n');print([(c['year'],len(c['rows'])) for c in out])
