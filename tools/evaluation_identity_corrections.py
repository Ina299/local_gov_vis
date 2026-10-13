"""Conservative, explicit removals of proven wrong municipality fallbacks."""
import json,hashlib,re

def apply_identity_corrections(root,out,index):
 path=root/'data/evaluations/navigation-identity-corrections.json'
 if not path.exists():return 0
 data=json.loads(path.read_text());assert data['schemaVersion']==1
 entries={e['municipalityCode']:e for e in index['municipalities']}
 for row in data['corrections']:
  e=entries[row['municipalityCode']];assert e['municipalityName']==row['municipalityName'] and e['prefectureCode']==row['prefectureCode']
  url=row['removeFallbackUrl'];assert e['officialFallback']['url']==url and e['officialFallback']['evidenceSha256']==row['evidenceSha256']
  assert re.fullmatch('[a-f0-9]{64}',row['evidenceSha256']) and row['reason'] and row['evidenceLocation']
  city=json.loads((out/e['shardPath']).read_text());assert city['officialFallback']['url']==url
  rejected=set(row.get('removeDirectoryUrls',[url]));assert url in rejected
  city['officialFallback']=None;city['officialDirectoryLinks']=[x for x in city['officialDirectoryLinks'] if x['url'] not in rejected];e['officialFallback']=None
  e['evidenceStatus']='text_available' if e['textDocumentCount'] else 'sources_available' if e['sourceCount'] else 'official_fallback_only' if e['officialHomepage'] else 'no_verified_sources'
  raw=(json.dumps(city,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode();(out/e['shardPath']).write_bytes(raw);e['shardBytes']=len(raw);e['shardSha256']=hashlib.sha256(raw).hexdigest()
 return len(data['corrections'])
