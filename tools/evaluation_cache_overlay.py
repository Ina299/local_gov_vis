"""Apply explicitly reviewed cached sources; does not fetch or decode raw files."""
import hashlib,json,re
from pathlib import Path

def encode(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()
def permits_explicit_text_recovery(old,new,item):
 """Only recover missing text from pinned successful bytes; all source metadata is immutable."""
 proof=item.get('textRecovery')
 if not isinstance(proof,dict) or proof.get('method')!='public_form_content_from_verified_bytes':return False
 if proof.get('previousSourceSha256')!=digest(encode(old)) or proof.get('previousTextStatus')!='no_readable_text':return False
 if {k:v for k,v in old.items() if k!='text'}!={k:v for k,v in new.items() if k!='text'}:return False
 a=old['acquisition'];t=old['text'];n=new['text']
 if old['verification']['status']!='verified' or old['format']!='html':return False
 if a['state']!='acquired' or a.get('inputStatus')!='fetched' or a.get('httpStatus')!=200 or a.get('method')!='network':return False
 raw=a.get('sourceSha256')
 if not isinstance(raw,str) or not re.fullmatch('[a-f0-9]{64}',raw) or proof.get('rawSourceSha256')!=raw:return False
 if any(a.get(k) is not None for k in ('containerSha256','memberPath','memberIndex')):return False
 if t['status']!='no_readable_text' or any(t.get(k) is not None for k in ('assetPath','assetSha256','textSha256','preview')) or t.get('assetBytes') or t.get('exportedCharacters') or t.get('truncated'):return False
 if t.get('inputTextSha256')!=raw or n.get('inputTextSha256')!=raw:return False
 if n.get('status')!='available' or n.get('extractionMethod')!='public_form_content_from_verified_bytes':return False
 return item.get('newDownload') is False and isinstance(item.get('document'),dict)

def apply_cache_overlay(root,out,index):
 manifest=root/'data/evaluations/reviewed-cache-sources.json'
 if not manifest.exists():return {'municipalities':0,'textAssets':0}
 payload=json.loads(manifest.read_text());assert payload['schemaVersion']==1 and payload['newRawDownloads']==0
 entries={e['municipalityCode']:e for e in index['municipalities']};cities={};text_assets=0;codes=set()
 for item in payload['sources']:
  code=item['municipalityCode'];entry=entries[code];assert item['municipalityName']==entry['municipalityName']
  s=item['source'];assert re.fullmatch('[a-f0-9]{24}',s['id']) and s['verification']['status']=='verified' and 'navigationReview' not in s
  assert item['newDownload'] is False and item['identityEvidence']['method']
  if code not in cities:cities[code]=json.loads((out/entry['shardPath']).read_text())
  city=cities[code];old=next((x for x in city['sources'] if x['id']==s['id']),None)
  if old and old['verification']['status']=='verified':assert old==s or permits_explicit_text_recovery(old,s,item),'Cannot silently replace already verified frozen evidence'
  if not old and any(x['url']==s['url'] for x in city['sources']):continue
  document=item['document']
  if document is not None:
   assert s['acquisition']['state']=='acquired' and re.fullmatch('[a-f0-9]{64}',s['acquisition']['sourceSha256'])
   assert s['text']['status']=='available' and s['text']['assetPath']==f"documents/{s['id']}.json"
   assert document['sourceId']==s['id'] and document['municipalityCode']==code and document['sourceUrl']==s['url'] and document['sourceSha256']==s['acquisition']['sourceSha256']
   assert document['textSha256']==digest(document['text'].encode())==s['text']['textSha256']
   assert document['exportedCharacters']==len(document['text'])<=120000 and document['characters']>=len(document['text'])
   raw=encode(document);assert digest(raw)==s['text']['assetSha256'] and len(raw)==s['text']['assetBytes']
   p=out/s['text']['assetPath'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw);text_assets+=1
  else:assert s['text']['status']!='available' and s['text']['assetPath'] is None
  if old:city['sources']=[s if x['id']==s['id'] else x for x in city['sources']]
  else:
   city['sources'].append(s)
   if s['acquisition']['state']=='acquired':city['discovery']['omittedRejectedSources']=max(0,city['discovery']['omittedRejectedSources']-1)
  codes.add(code)
 for code,city in cities.items():
  entry=entries[code];ss=city['sources'];city['evaluationPages']=[s['id'] for s in ss if s['role']=='evaluation_landing_page' and s['verification']['status']=='verified'];city['discovery']['coverageCompleteness']='not_established'
  if any(s['acquisition']['state']=='acquired' for s in ss):city['discovery']['status']='fetched'
  entry.update(discoveryStatus=city['discovery']['status'],evaluationPageCount=len(city['evaluationPages']),sourceCount=sum(s['verification']['status']=='verified' for s in ss),candidateCount=sum(s['verification']['status']!='verified' for s in ss),acquiredCount=sum(s['acquisition']['state']=='acquired' for s in ss),textDocumentCount=sum(s['text']['status']=='available' for s in ss),substantiveTextDocumentCount=sum(s['text']['status']=='available' and s['role']=='evaluation_document' for s in ss))
  entry['evidenceStatus']='text_available' if entry['textDocumentCount'] else 'sources_available' if entry['sourceCount'] else 'official_fallback_only' if entry['officialHomepage'] or entry['officialFallback'] else 'no_verified_sources'
  raw=encode(city);(out/entry['shardPath']).write_bytes(raw);entry['shardBytes']=len(raw);entry['shardSha256']=digest(raw)
 index['counts']['reviewedCachedMunicipalities']=len(codes);index['counts']['cachedTextAssetsRecovered']=text_assets
 index['snapshotAt']=max(index['snapshotAt'],payload['reviewedAt'])
 return {'municipalities':len(codes),'textAssets':text_assets,'preparedInputSha256':digest(manifest.read_bytes())}
