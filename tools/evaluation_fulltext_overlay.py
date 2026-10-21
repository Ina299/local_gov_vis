"""Attach pinned continuation parts to truncated text documents; the first part and its hashes never change."""
import hashlib,json,re

def encode(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()

def apply_fulltext_overlay(root,out,index):
 manifest=root/'data/evaluations/fulltext-continuations.json'
 if not manifest.exists():return {'sources':0,'parts':0}
 payload=json.loads(manifest.read_text(encoding='utf-8'));assert payload['schemaVersion']==1
 entries={e['municipalityCode']:e for e in index['municipalities']};cities={};parts=0
 for item in payload['sources']:
  code=item['municipalityCode'];entry=entries[code]
  if code not in cities:cities[code]=json.loads((out/entry['shardPath']).read_text(encoding='utf-8'))
  matches=[s for s in cities[code]['sources'] if s['id']==item['sourceId']];assert len(matches)==1
  s=matches[0];t=s['text']
  assert s['url']==item['url'] and s['acquisition']['sourceSha256']==item['sourceSha256']
  assert t['status']=='available' and t['truncated'] and t['characters']==item['characters'] and t['textSha256']==item['firstPartTextSha256']
  assert 'continuations' not in t
  first=json.loads((root/'apps/web/public/evaluation-evidence'/t['assetPath']).read_text(encoding='utf-8'));full=first['text']
  start=t['exportedCharacters'];expected=2
  for c in item['continuations']:
   assert c['part']==expected and c['startCharacter']==start and c['assetPath']==f"documents/{s['id']}-{c['part']}.json" and 0<c['exportedCharacters']<=120000
   data=(root/'apps/web/public/evaluation-evidence'/c['assetPath']).read_bytes()
   assert len(data)==c['assetBytes']<=1024*1024 and digest(data)==c['assetSha256'],'Continuation asset changed'
   doc=json.loads(data)
   assert doc['sourceId']==s['id'] and doc['municipalityCode']==code and doc['sourceUrl']==s['url'] and doc['sourceSha256']==item['sourceSha256']
   assert doc['part']==c['part'] and doc['startCharacter']==start and doc['exportedCharacters']==len(doc['text'])==c['exportedCharacters']
   assert digest(doc['text'].encode())==doc['textSha256']==c['textSha256'] and doc['fullTextSha256']==item['fullTextSha256']
   dest=out/c['assetPath']
   if dest.resolve()!=(root/'apps/web/public/evaluation-evidence'/c['assetPath']).resolve():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
   full+=doc['text'];start+=c['exportedCharacters'];expected+=1;parts+=1
  assert start==t['characters'] and digest(full.encode())==item['fullTextSha256'],'Continuations do not complete the document'
  t['fullTextSha256']=item['fullTextSha256'];t['continuations']=item['continuations']
 for code,city in cities.items():
  entry=entries[code];raw=encode(city);(out/entry['shardPath']).write_bytes(raw);entry['shardBytes']=len(raw);entry['shardSha256']=digest(raw)
 index['counts']['fullTextContinuationDocuments']=len(payload['sources']);index['counts']['fullTextContinuationParts']=parts
 return {'sources':len(payload['sources']),'parts':parts,'preparedInputSha256':digest(manifest.read_bytes())}
