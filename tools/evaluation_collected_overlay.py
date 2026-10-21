"""Apply sources acquired by the source-collection run; upgrades only unacquired verified rows."""
import hashlib,json,re
from pathlib import Path

def encode(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()

def apply_collected_overlays(root,out,index):
 """Apply every collection batch in order; later batches only upgrade rows still unacquired."""
 reports=[apply_collected_overlay(root,out,index,p) for p in sorted((root/'data/evaluations').glob('collected-sources-batch*.json'),key=lambda p:int(re.search(r'batch(\d+)',p.name).group(1)))]
 index['counts']['collectedMunicipalities']=len({c for r in reports for c in r['codes']});index['counts']['collectedSources']=sum(r['acquired'] for r in reports);index['counts']['collectedTextAssets']=sum(r['textAssets'] for r in reports)
 return [{k:v for k,v in r.items() if k!='codes'} for r in reports]

def apply_collected_overlay(root,out,index,manifest):
 payload=json.loads(manifest.read_text(encoding='utf-8'));assert payload['schemaVersion']==1
 entries={e['municipalityCode']:e for e in index['municipalities']};cities={};acquired=0;text_assets=0;truncated=0
 for item in payload['sources']:
  code=item['municipalityCode'];entry=entries[code];assert item['municipalityName']==entry['municipalityName']
  if code not in cities:cities[code]=json.loads((out/entry['shardPath']).read_text(encoding='utf-8'))
  city=cities[code];matches=[x for x in city['sources'] if x['id']==item['sourceId']];assert len(matches)==1,'Collected source is not in the frozen shard'
  old=matches[0];a=item['acquisition'];t=item['text']
  assert old['url']==item['url'] and old['verification']['status']=='verified'
  # Never replace evidence that already has bytes; only a discovered/blocked row may be upgraded.
  assert old['acquisition']['state']==item['previousAcquisitionState'] and old['acquisition']['state'] in ('discovered','blocked') and old['acquisition']['sourceSha256'] is None and old['text']['status']=='not_acquired'
  assert a['state']=='acquired' and a['httpStatus']==200 and re.fullmatch('[a-f0-9]{64}',a['sourceSha256']) and t['inputTextSha256']==a['sourceSha256']
  if t['status']=='available':
   assert t['assetPath']==f"documents/{old['id']}.json"
   data=(root/'apps/web/public/evaluation-evidence'/t['assetPath']).read_bytes()
   assert len(data)==t['assetBytes'] and digest(data)==t['assetSha256'],'Collected text asset changed'
   doc=json.loads(data);assert doc['sourceId']==old['id'] and doc['municipalityCode']==code and doc['sourceUrl']==old['url'] and doc['sourceSha256']==a['sourceSha256']
   assert doc['textSha256']==digest(doc['text'].encode())==t['textSha256'] and doc['exportedCharacters']==len(doc['text'])<=120000
   dest=out/t['assetPath']
   if dest.resolve()!=(root/'apps/web/public/evaluation-evidence'/t['assetPath']).resolve():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
   text_assets+=1;truncated+=bool(t['truncated'])
  else:assert t['status']=='no_readable_text' and t['assetPath'] is None
  if 'navigationReview' in old:
   assert old['navigationReview']['method']=='official_body_review' and old['navigationReview']['rawArchiveState']=='not_downloaded'
   old['navigationReview']['rawArchiveState']='collected'
  old['acquisition']=a;old['text']=t;acquired+=1
 for code,city in cities.items():
  entry=entries[code];ss=city['sources']
  if any(s['acquisition']['state']=='acquired' for s in ss):city['discovery']['status']='fetched'
  entry.update(discoveryStatus=city['discovery']['status'],acquiredCount=sum(s['acquisition']['state']=='acquired' for s in ss),textDocumentCount=sum(s['text']['status']=='available' for s in ss),substantiveTextDocumentCount=sum(s['text']['status']=='available' and s['role']=='evaluation_document' for s in ss))
  entry['evidenceStatus']='text_available' if entry['textDocumentCount'] else 'sources_available' if entry['sourceCount'] else 'official_fallback_only' if entry['officialHomepage'] or entry['officialFallback'] else 'no_verified_sources'
  raw=encode(city);(out/entry['shardPath']).write_bytes(raw);entry['shardBytes']=len(raw);entry['shardSha256']=digest(raw)
 index['counts']['truncatedTextDocuments']+=truncated
 index['snapshotAt']=max(index['snapshotAt'],payload['collectedAt'])
 return {'batch':manifest.name,'codes':sorted(cities),'municipalities':len(cities),'acquired':acquired,'textAssets':text_assets,'preparedInputSha256':digest(manifest.read_bytes())}
