"""Reproduce only reviewed complete sections of a verified cached prefix; offline."""
import hashlib,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[4];stage=Path(__file__).parent;docs=root/'apps/web/public/evaluation-evidence'
c=json.loads((stage/'hatsukaichi-bounded-reviewed.json').read_text());sid=c['sourceId']
s=next(s for s in json.loads((docs/'municipalities'/(c['municipalityCode']+'.json')).read_text())['sources'] if s['id']==sid);i=s['text'];b=(docs/i['assetPath']).read_bytes()
assert len(b)==i['assetBytes'] and hashlib.sha256(b).hexdigest()==i['assetSha256'];d=json.loads(b);t=d['text'];u=t.encode('utf-16-le')
assert d['sourceId']==sid and d['municipalityCode']==c['municipalityCode'] and d['sourceUrl']==s['url']==c['sourceUrl']
assert d['sourceSha256']==s['acquisition']['sourceSha256']==c['sourceSha256']
assert i['truncated'] and not i.get('continuations')
assert len(t)==i['exportedCharacters']==c['exportedCharacters']<i['characters']==c['originalCharacters']
assert hashlib.sha256(t.encode()).hexdigest()==i['textSha256']==c['prefixSha256'] and c['proof'] in t
for r in c['rows']:
 assert u[r['start']*2:r['start']*2+len(r['raw'].encode('utf-16-le'))].decode('utf-16-le')==r['raw']
 assert u[r['contextStart']*2:r['end']*2].decode('utf-16-le')==r['context']
 assert r['contextStart']<=r['start'] and r['start']+len(r['raw'].encode('utf-16-le'))//2<=r['end']
 assert re.match(r'７．\s*昨年度の取[組り]',r['context']) and u[r['end']*2:].decode('utf-16-le').startswith('８．')
 assert r['name']==r['raw'].replace('\n','')
out=root/'apps/crawler/src/evaluations/expansion/descending-hatsukaichi-bounded-map.ts'
out.write_text('// Reviewed complete retrospective sections in pinned prefix; missing original tail excluded.\nexport const hatsukaichiBounded = '+json.dumps(c,ensure_ascii=False,indent=2)+';\n')
print('Verified prefix sections, proposals',len(c['rows']))
