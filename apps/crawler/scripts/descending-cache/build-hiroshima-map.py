import json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[4];docs=root/'apps/web/public/evaluation-evidence/documents';configs=[];stage=Path(__file__).parent
inventory=json.loads((root/'data/evaluations/descending-offline/34/source-ledger.json').read_text())
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
def cached_text(id):
 q=next(x for x in inventory if x['sourceId']==id)
 return verified_text(id,q['municipalityCode'])
def source(id,code,fy,ey,proof):
 q=next(x for x in inventory if x['sourceId']==id);assert q['municipalityCode']==code
 t=verified_text(id,code);assert proof in t
 c=dict(sourceId=id,municipalityCode=code,year=fy,evaluationYear=ey,proof=proof,fullTextSha256=hashlib.sha256(t.encode()).hexdigest(),rows=[],holds=[]);configs.append(c);return c,t
def row(c,t,name,raw=None,start=None,note='Explicit cached business title only; no costs or policy scores inferred.'):
 raw=raw or name;a=t.index(raw) if start is None else start;assert t[a:a+len(raw)]==raw
 c['rows'].append(dict(name=name,raw=raw,start=len(t[:a].encode('utf-16-le'))//2,note=note))
def hold(c,t,raw,reason,status='identity_or_period_hold'):
 a=t.index(raw);c['holds'].append(dict(raw=raw,start=len(t[:a].encode('utf-16-le'))//2,reason=reason,status=status))
for c in json.loads((stage/'hiroshima-reviewed.json').read_text()):
 t=verified_text(c['sourceId'],c['municipalityCode']);assert hashlib.sha256(t.encode()).hexdigest()==c['fullTextSha256'];assert c['proof'] in t;u=t.encode('utf-16-le')
 for h in c['rows']+c['holds']:
  assert u[h['start']*2:h['start']*2+len(h['raw'].encode('utf-16-le'))].decode('utf-16-le')==h['raw']
  if h.get('context'):assert u[h['contextStart']*2:h['contextStart']*2+len(h['context'].encode('utf-16-le'))].decode('utf-16-le')==h['context']
  if h.get('yearProof'):assert h['yearProof'] in t
 configs.append(c)
for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-hiroshima-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const hiroshimaRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
