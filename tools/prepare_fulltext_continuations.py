#!/usr/bin/env python3
"""Re-extract truncated documents from their saved originals and publish the rest as continuation parts (offline).

The first part (documents/{id}.json, first 120,000 code points) is never rewritten: the re-extracted text must
reproduce it exactly, and its character count must equal the recorded `characters`, or the source is skipped.
Continuations are written as documents/{id}-{part}.json; the manifest pins every hash for the evidence build.
"""
import argparse,datetime,hashlib,json,os,pathlib
from prepare_collected_sources import pdf_text,html_text,encode,digest,MAX_CHARS

def originals(dirs):
 """sha256 -> (object path, content type) across every collection run directory."""
 found={}
 for d in dirs:
  manifest=d/'manifest.json'
  if not manifest.exists():continue
  for e in json.loads(manifest.read_text(encoding='utf-8'))['entries'].values():
   if e['state']=='fetched':found.setdefault(e['sha256'],(d/e['file'],e.get('contentType')))
 return found

def build(root,source_dirs,pdftotext,generated_at):
 public=root/'apps/web/public/evaluation-evidence';found=originals(source_dirs)
 out=[];report={'truncated':0,'noOriginal':0,'mismatch':0,'published':0,'parts':0}
 for shard in sorted((public/'municipalities').glob('*.json')):
  city=json.loads(shard.read_text(encoding='utf-8'));code=city['municipality']['municipalityCode']
  for s in city['sources']:
   t=s['text']
   if t['status']!='available' or not t['truncated']:continue
   report['truncated']+=1
   raw_sha=s['acquisition'].get('sourceSha256')
   if raw_sha not in found or s['acquisition'].get('memberPath'):report['noOriginal']+=1;continue
   path,ctype=found[raw_sha];raw=path.read_bytes()
   assert digest(raw)==raw_sha,'Original integrity failure'
   full=pdf_text(raw,pdftotext) if raw[:5]==b'%PDF-' else html_text(raw,s['url'],ctype)
   first=json.loads((public/t['assetPath']).read_text(encoding='utf-8'))
   # Only publish when re-extraction reproduces the published first part byte-for-byte.
   if not full or len(full)!=t['characters'] or full[:MAX_CHARS]!=first['text'] or digest(first['text'].encode())!=t['textSha256']:report['mismatch']+=1;continue
   full_sha=digest(full.encode());parts=[];start=len(first['text']);part=2
   while start<len(full):
    chunk=full[start:start+MAX_CHARS]
    doc={'exportedCharacters':len(chunk),'fullTextSha256':full_sha,'label':'unstructured_source_text_continuation','municipalityCode':code,'part':part,
     'schemaVersion':1,'sourceId':s['id'],'sourceSha256':raw_sha,'sourceUrl':s['url'],'startCharacter':start,'text':chunk,'textSha256':digest(chunk.encode())}
    asset=encode(doc);rel=f"documents/{s['id']}-{part}.json";dest=public/rel
    assert not dest.exists() or dest.read_bytes()==asset,'Refusing to overwrite a different continuation'
    dest.write_bytes(asset)
    parts.append({'part':part,'assetPath':rel,'assetBytes':len(asset),'assetSha256':digest(asset),'startCharacter':start,'exportedCharacters':len(chunk),'textSha256':doc['textSha256']})
    start+=len(chunk);part+=1
   report['published']+=1;report['parts']+=len(parts)
   out.append({'municipalityCode':code,'sourceId':s['id'],'url':s['url'],'sourceSha256':raw_sha,'characters':t['characters'],'firstPartTextSha256':t['textSha256'],'fullTextSha256':full_sha,'continuations':parts})
 out.sort(key=lambda x:(x['municipalityCode'],x['sourceId']))
 return {'schemaVersion':1,'generatedAt':generated_at,'partCharacters':MAX_CHARS,'sources':out},report

if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--sources-dir',default=os.environ.get('EVALUATION_SOURCES_DIR','apps/crawler/output'))
 p.add_argument('--pdftotext',default='tools/poppler-24.08.0/Library/bin/pdftotext.exe')
 p.add_argument('--out',default='data/evaluations/fulltext-continuations.json')
 a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1];base=pathlib.Path(a.sources_dir)
 if not base.is_absolute():base=root/base
 dirs=sorted(x for x in base.iterdir() if x.is_dir() and x.name.startswith('source-collection'))
 payload,report=build(root,dirs,root/a.pdftotext,datetime.datetime.now(datetime.timezone.utc).isoformat())
 (root/a.out).write_bytes(encode(payload));print(json.dumps(report,indent=1))
