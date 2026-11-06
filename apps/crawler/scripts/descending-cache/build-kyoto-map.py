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
for c in json.loads((stage/'kyoto-reviewed.json').read_text()):
 t=verified_text(c['sourceId'],c['municipalityCode']);assert hashlib.sha256(t.encode()).hexdigest()==c['fullTextSha256'];assert c['proof'] in t;u=t.encode('utf-16-le')
 for h in c['rows']+c['holds']:
  if 'name' in h: assert h['name'] in h['raw'] or h.get('titleFragments') or h.get('titleSegments') or h.get('composedTitle'), 'Title needs literal or fragment proof'
  assert u[h['start']*2:h['start']*2+len(h['raw'].encode('utf-16-le'))].decode('utf-16-le')==h['raw']
  if h.get('context'):assert u[h['contextStart']*2:h['contextStart']*2+len(h['context'].encode('utf-16-le'))].decode('utf-16-le')==h['context']
  if h.get('yearProof'):assert h['yearProof'] in t
  if h.get('departmentSegments'):
   ds=h['departmentSegments'];assert not h.get('departmentProof') and len(ds)>=2 and h['department']==re.sub(r'\s+','',''.join(d['raw'] for d in ds));spans=[]
   for d in ds:
    a=d['start'];b=a+len(d['raw'].encode('utf-16-le'))//2;assert a>=h['start'] and b<=h['start']+len(h['raw'].encode('utf-16-le'))//2 and u[a*2:b*2].decode('utf-16-le')==d['raw'];spans.append((a,b))
   spans.sort();assert all(spans[k][0]>=spans[k-1][1] for k in range(1,len(spans)))
  elif h.get('department') or h.get('departmentProof'):
   d=h['departmentProof'];assert h['department']==re.sub(r'\s+','',d['raw']);assert u[d['start']*2:d['start']*2+len(d['raw'].encode('utf-16-le'))].decode('utf-16-le')==d['raw'];assert h['contextStart']==d['start'] and h['context'].startswith(d['raw'])
  if h.get('titleFragments'):
   assert h['name']==re.sub(r'\s+','',''.join(h['titleFragments']))
   offset=0
   for fragment in h['titleFragments']:
    at=h['raw'].find(fragment,offset);assert at>=0;offset=at+len(fragment)
  if h.get('titleSegments'):
   assert not h.get('titleFragments') and len(h['titleSegments'])>=2
   spans=[]
   for seg in h['titleSegments']:
    a=seg['start'];b=a+len(seg['raw'].encode('utf-16-le'))//2;assert a>=h['start'] and b<=h['start']+len(h['raw'].encode('utf-16-le'))//2
    assert u[a*2:b*2].decode('utf-16-le')==seg['raw'];spans.append((a,b))
   spans.sort();assert all(spans[k][0]>=spans[k-1][1] for k in range(1,len(spans)))
   assert h['name']==re.sub(r'\s+','',''.join(seg['raw'] for seg in h['titleSegments']))
  if h.get('composedTitle'):
   ct=h['composedTitle'];assert ct['baseSegments'] and not h.get('titleSegments') and not h.get('titleFragments');spans=[]
   for seg in ct['baseSegments']+ct['descriptionSegments']:
    a=seg['start'];b=a+len(seg['raw'].encode('utf-16-le'))//2;assert seg['raw'] and a>=h['start'] and b<=h['start']+len(h['raw'].encode('utf-16-le'))//2
    assert u[a*2:b*2].decode('utf-16-le')==seg['raw'];spans.append((a,b))
   spans.sort();assert all(spans[k][0]>=spans[k-1][1] for k in range(1,len(spans)))
   base=''.join(x['raw'] for x in ct['baseSegments']);desc=''.join(x['raw'] for x in ct['descriptionSegments']);assert h['name']==base+('【説明名称：'+desc+'】' if desc else '')
 if c.get('pageId'):
  m=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in m['sources'] if x['id']==c['sourceId']);page=next(x for x in m['sources'] if x['id']==c['pageId']);pt=verified_text(c['pageId'],c['municipalityCode'])
  assert hashlib.sha256(pt.encode()).hexdigest()==c['pageHash'] and c['pageProof'] in pt
  if c.get('pageTargetYearProof'):assert isinstance(c['year'],int) and c['pageTargetYearProof'] in pt and any(y in re.sub(r'\s+','',c['pageTargetYearProof']) for y in [str(c['year'])+'年度','平成'+str(c['year']-1988)+'年度','令和'+str(c['year']-2018)+'年度'])
  if c.get('pagePeriodProof'):assert c['pagePeriodProof'] in pt and str(c['evaluationYear'])+'年度' in c['pagePeriodProof']
  if c.get('pageYearContext'):
   pu=pt.encode('utf-16-le');a=c['pageYearContextStart'];ctx=c['pageYearContext'];assert isinstance(a,int) and a>=0 and pu[a*2:a*2+len(ctx.encode('utf-16-le'))].decode('utf-16-le')==ctx and c['pageProof'] in ctx and '前年度' in ctx
  assert src['title']==c['savedLinkTitle']==c['pageProof'] and src['navigationReview']==c['savedLinkRelation']
  assert src['navigationReview']['evidenceUrl']==page['url']==c['pageUrl'] and page['acquisition']['sourceSha256']==c['pageSourceSha256']

 configs.append(c)
for c in configs:
 meta=json.loads((docs.parent/'municipalities'/(c['municipalityCode']+'.json')).read_text());src=next(x for x in meta['sources'] if x['id']==c['sourceId']);c['sourceSha256']=src['acquisition']['sourceSha256'];c['sourceUrl']=src['url'];c['recordedFormat']=src['format'];d=json.loads((docs/(c['sourceId']+'.json')).read_text());c['format']='pdf' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='pdftotext_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else 'html' if src['format'] not in ['pdf','html','xlsx'] and d.get('extractionMethod')=='visible_html_from_verified_bytes' and d['sourceSha256']==src['acquisition']['sourceSha256'] else src['format']
(root/'apps/crawler/src/evaluations/expansion/descending-kyoto-map.ts').write_text('// Generated from hash-verified complete cached texts; no municipal requests.\nexport const kyotoRows = '+json.dumps(configs,ensure_ascii=False,indent=2)+';\n')
print('reviewed sources',len(configs),'proposals',sum(len(c['rows']) for c in configs))
