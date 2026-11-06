import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[4];docs=root/'apps/web/public/evaluation-evidence/documents';configs=[];stage=Path(__file__).parent
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
for c in json.loads((stage/'mie-reviewed.json').read_text()):
 t=verified_text(c['sourceId'],c['municipalityCode']);assert hashlib.sha256(t.encode()).hexdigest()==c['fullTextSha256'];assert c['proof'] in t;u=t.encode('utf-16-le')
 for h in c['rows']+c['holds']:
  assert u[h['start']*2:h['start']*2+len(h['raw'].encode('utf-16-le'))].decode('utf-16-le')==h['raw']
  for seg in h.get('titleSegments',[]):assert u[seg['start']*2:seg['start']*2+len(seg['raw'].encode('utf-16-le'))].decode('utf-16-le')==seg['raw']
  if h.get('yearProof'):assert h['yearProof'] in t
  for key in ['yearContext','contextProof']:
   if h.get(key):
    a=h[key];assert u[a['start']*2:a['start']*2+len(a['raw'].encode('utf-16-le'))].decode('utf-16-le')==a['raw']
  if h.get('yearProofStart') is not None:
   a=h['yearProofStart'];raw=h['yearProof'];assert u[a*2:a*2+len(raw.encode('utf-16-le'))].decode('utf-16-le')==raw
 configs.append(c)
(root/'apps/crawler/src/evaluations/expansion/descending-mie-map.ts').write_text('// Generated from hash-verified cached sources; do not edit manually.\nexport const mieRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed Mie sources',len(configs),'raw proposals',sum(len(c['rows'])for c in configs))
