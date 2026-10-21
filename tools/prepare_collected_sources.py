#!/usr/bin/env python3
"""Turn a finished source-collection run into a reviewed text overlay (offline).

Reads the collector manifest and its hash-addressed objects, re-verifies every
byte hash, and matches each fetched URL back to the unacquired row of the frozen
navigation base it came from. Text is extracted from the verified bytes only
(PDF: poppler pdftotext, HTML: the public-body extractor). Nothing is fetched. Text assets are written to the public
evidence directory; the overlay manifest pins their hashes.
Years, roles and titles are never changed; unreadable files stay text-less.
"""
import argparse,datetime,gzip,hashlib,json,pathlib,re,subprocess,tempfile
from evaluation_public_html import extract_public_body

MAX_CHARS=120000
PDF_METHOD='pdftotext_from_verified_bytes'
HTML_METHOD='visible_html_from_verified_bytes'
def encode(obj):return (json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()

def pdf_text(raw,pdftotext):
 if raw[:5]!=b'%PDF-':return None
 with tempfile.TemporaryDirectory() as tmp:
  src=pathlib.Path(tmp)/'in.pdf';dst=pathlib.Path(tmp)/'out.txt';src.write_bytes(raw)
  try:subprocess.run([str(pdftotext),'-enc','UTF-8','-q',str(src),str(dst)],check=True,timeout=120,capture_output=True)
  except (subprocess.CalledProcessError,subprocess.TimeoutExpired):return None
  text=dst.read_text(encoding='utf-8',errors='strict') if dst.exists() else ''
 text=re.sub(r'[\x00-\x08\x0b\x0e-\x1f\x7f]','',text.replace('\f','\n'))
 text='\n'.join(line.rstrip() for line in text.splitlines()).strip()
 # Image-only PDFs yield nothing useful; do not publish an empty shell as readable text.
 return text if len(re.sub(r'\s','',text))>=40 else None

def html_text(raw,url,content_type):
 charset=None
 m=re.search(r'charset=([\w-]+)',content_type or '',re.I) or re.search(rb'<meta[^>]+charset=["\']?([\w-]+)',raw[:4096],re.I)
 if m:charset=(m.group(1).decode() if isinstance(m.group(1),bytes) else m.group(1)).lower()
 if charset and charset.replace('_','-') not in ('utf-8','utf8'):
  try:raw=raw.decode({'shift-jis':'cp932','shift_jis':'cp932','sjis':'cp932','x-sjis':'cp932','euc-jp':'euc_jp'}.get(charset,charset),errors='strict').encode('utf-8')
  except (LookupError,UnicodeDecodeError):return None
 result=extract_public_body(raw,url,200)
 return result['text'] if result['status']=='candidate_public_body' else None

def build(root,manifest_path,pdftotext,generated_at):
 collection=manifest_path.parent
 manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
 frozen=json.loads(gzip.open(root/'data/evaluations/navigation-base-v1.json.gz').read())
 rows={}
 for name,content in frozen['files'].items():
  if not name.startswith('municipalities/'):continue
  city=json.loads(content)
  for s in city['sources']:rows.setdefault((city['municipality']['municipalityCode'],s['url']),[]).append((city['municipality'],s))
 normalize=json.loads(subprocess.run(['node','-e','const u=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(JSON.stringify(Object.fromEntries(u.map(x=>{try{return [new URL(x).href,x]}catch{return [x,x]}}))))'],input=json.dumps([k[1] for k in rows]),capture_output=True,text=True,check=True,encoding='utf-8').stdout)
 out=[];report={'fetched':0,'matched':0,'textAvailable':0,'noReadableText':0,'unmatched':[]}
 for entry in manifest['entries'].values():
  if entry['state']!='fetched':continue
  report['fetched']+=1;src=entry['source'];code=src['municipalityCode']
  original=normalize.get(src['url'],src['url']);match=[r for r in rows.get((code,original),[]) if r[1]['acquisition']['state'] in ('discovered','blocked') and r[1]['verification']['status']=='verified']
  if len(match)!=1:report['unmatched'].append(src['url']);continue
  municipality,row=match[0]
  raw=(collection/entry['file']).read_bytes()
  assert entry['file']==f"objects/{entry['sha256']}.bin" and digest(raw)==entry['sha256'] and len(raw)==entry['bytes'],'Cache integrity failure'
  report['matched']+=1
  is_pdf=raw[:5]==b'%PDF-'
  text=pdf_text(raw,pdftotext) if is_pdf else html_text(raw,row['url'],entry.get('contentType')) if row['format'] in ('html','htm','php','aspx') or 'html' in (entry.get('contentType') or '') else None
  acquisition={'containerSha256':None,'fetchedAt':entry['fetchedAt'],'httpStatus':200,'inputStatus':'fetched','memberIndex':None,'memberPath':None,'method':'network','sourceSha256':entry['sha256'],'state':'acquired'}
  if text:
   exported=text[:MAX_CHARS];method=PDF_METHOD if is_pdf else HTML_METHOD
   document={'acquisitionMethod':'network','characters':len(text),'containerSha256':None,'exportedCharacters':len(exported),'extractionMethod':method,'inputTextSha256':entry['sha256'],'label':'unstructured_source_text','memberIndex':None,'memberPath':None,'municipalityCode':code,'schemaVersion':1,'sourceId':row['id'],'sourceSha256':entry['sha256'],'sourceUrl':row['url'],'text':exported,'textSha256':digest(exported.encode()),'truncated':len(text)>len(exported)}
   asset=encode(document);path=root/'apps/web/public/evaluation-evidence/documents'/f"{row['id']}.json"
   assert not path.exists() or path.read_bytes()==asset,'Refusing to overwrite a different text asset'
   path.write_bytes(asset)
   text_meta={'assetBytes':len(asset),'assetPath':f"documents/{row['id']}.json",'assetSha256':digest(asset),'characters':len(text),'exportedCharacters':len(exported),'extractionMethod':method,'inputTextSha256':entry['sha256'],'label':'unstructured_source_text','preview':exported[:1000],'status':'available','textSha256':document['textSha256'],'truncated':document['truncated']}
   report['textAvailable']+=1
  else:
   text_meta={'assetBytes':0,'assetPath':None,'assetSha256':None,'characters':0,'exportedCharacters':0,'extractionMethod':None,'inputTextSha256':entry['sha256'],'label':'unstructured_source_text','preview':None,'status':'no_readable_text','textSha256':None,'truncated':False}
   report['noReadableText']+=1
  out.append({'municipalityCode':code,'municipalityName':municipality['municipalityName'],'sourceId':row['id'],'url':row['url'],'previousAcquisitionState':row['acquisition']['state'],'collectorEntrySha256':digest(encode(entry)),'acquisition':acquisition,'text':text_meta})
 out.sort(key=lambda x:(x['municipalityCode'],x['sourceId']))
 return {'schemaVersion':1,'generatedAt':generated_at,'collectedAt':max((x['acquisition']['fetchedAt'] for x in out),default=generated_at),'collector':'apps/crawler/src/source-collection','collectorManifestSha256':digest(manifest_path.read_bytes()),'sources':out},report

if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--manifest',default='apps/crawler/output/source-collection/manifest.json')
 p.add_argument('--pdftotext',default='tools/poppler-24.08.0/Library/bin/pdftotext.exe')
 p.add_argument('--out',default='data/evaluations/collected-sources-batch7.json')
 a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1]
 payload,report=build(root,root/a.manifest,root/a.pdftotext,datetime.datetime.now(datetime.timezone.utc).isoformat())
 (root/a.out).write_bytes(encode(payload))
 report['unmatched']=report['unmatched'][:20];print(json.dumps(report,ensure_ascii=False,indent=1))
