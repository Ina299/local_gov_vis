#!/usr/bin/env python3
"""Build the prefecture evaluation evidence (47 prefectures) from the discovery record and collected originals (offline).

  PYTHONUTF8=1 python tools/build_prefecture_evidence.py --discovery data/evaluations/prefecture-discovery-r1.json \
      --collection I:/local_gov_crawler_sources/prefecture-r1 [--collection ...] --pdftotext tools/poppler-24.08.0/Library/bin/pdftotext.exe

Writes apps/web/public/evaluation-evidence-prefectures/index.json (scope 47), prefectures/{PP000}.json (shards) and
documents/{id}[-{part}].json (text), apart from the municipal evaluation-evidence/ tree. The shard/text schema is the municipal one, so the same web loader validates it.
Every link comes from the discovery record (printed on an official prefecture page); bytes are re-hashed before use,
text is extracted only from those bytes, years are never inferred, and nothing is fetched.
"""
import argparse,hashlib,io,json,pathlib,re,sys,urllib.parse
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from prepare_collected_sources import pdf_text,html_text,encode,digest,MAX_CHARS,PDF_METHOD,HTML_METHOD

XLSX_METHOD='spreadsheet_cells_from_verified_bytes'
TYPES={'business_project_evaluation','policy_evaluation','facility_evaluation','education_inspection','mixed_evaluation','grant_project_evaluation','administrative_reform','project_activity_report','sector_evaluation','unknown'}
OFFICIAL=re.compile(r'(^|\.)(pref\.[a-z]+|metro\.tokyo)\.(lg\.)?jp$')

def source_id(code,url):return digest(('prefecture-evidence-v1\0'+code+'\0'+url).encode())[:24]
def official(url):
 u=urllib.parse.urlsplit(url)
 return u.scheme in ('https','http') and bool(u.hostname) and not u.username and not u.password and bool(OFFICIAL.search(u.hostname))

def sheet_text(raw):
 """Cells of every sheet, tab-separated, in sheet order. Formulas are not evaluated (cached values only)."""
 rows=[]
 if raw[:4]==b'PK\x03\x04':
  import openpyxl
  try:wb=openpyxl.load_workbook(io.BytesIO(raw),read_only=True,data_only=True)
  except Exception:return None
  for ws in wb.worksheets:
   rows.append(f'【{ws.title}】')
   for r in ws.iter_rows(values_only=True):
    cells=['' if v is None else str(v).strip() for v in r]
    while cells and not cells[-1]:cells.pop()
    if cells:rows.append('\t'.join(cells))
 elif raw[:8]==bytes.fromhex('d0cf11e0a1b11ae1'):
  import xlrd
  try:wb=xlrd.open_workbook(file_contents=raw)
  except Exception:return None
  for ws in wb.sheets():
   rows.append(f'【{ws.name}】')
   for i in range(ws.nrows):
    cells=[str(v).strip() for v in ws.row_values(i)]
    while cells and not cells[-1]:cells.pop()
    if cells:rows.append('\t'.join(cells))
 else:return None
 text=re.sub(r'[\x00-\x08\x0b\x0e-\x1f\x7f]','','\n'.join(rows)).strip()
 return text if len(re.sub(r'\s','',text))>=40 else None

def load_collections(dirs):
 """url -> (collection dir, entry). A later collection wins only for a URL that the earlier one did not fetch."""
 found={}
 for d in dirs:
  manifest=json.loads((d/'manifest.json').read_text(encoding='utf-8'))
  for e in manifest['entries'].values():
   url=e['source']['url']
   if url in found and found[url][1]['state']=='fetched':continue
   found[url]=(d,e)
 return found

def build(root,discovery,collections,pdftotext):
 public=root/'apps/web/public/evaluation-evidence-prefectures'
 (public/'prefectures').mkdir(parents=True,exist_ok=True);(public/'documents').mkdir(parents=True,exist_ok=True)
 record=json.loads(discovery.read_text(encoding='utf-8'));collected=load_collections(collections)
 entries=[];report={'sources':0,'acquired':0,'text':0,'noText':0,'failed':0,'discovered':0,'continuationParts':0}
 snapshot=record['mergedAt'];truncated_docs=0
 for p in record['prefectures']:
  pc=p['prefectureCode'];code=pc+'000';name=p['prefectureName'];sources=[];seen=set()
  links=[('evaluation_landing_page',l) for l in p['landingPages']]+[('evaluation_document',l) for l in p['documents']]
  for role,link in links:
   url=link['url']
   if url in seen:continue
   seen.add(url)
   if not official(url):raise ValueError(f'Non-official URL in discovery record: {url}')
   fmt=(link.get('format') or ('html' if role=='evaluation_landing_page' else 'unknown')).lower()
   etype=link.get('evaluationType') if link.get('evaluationType') in TYPES else 'unknown'
   evidence_url=link.get('evidenceUrl') if link.get('evidenceUrl') and official(link['evidenceUrl']) else url
   sid=source_id(code,url);hit=collected.get(url)
   review={'method':'official_body_review','checkedAt':record['mergedAt'],'publisher':name,'evidenceUrl':evidence_url,'originEvidenceUrl':None,
    'notes':'都道府県の公式ページに掲載されたリンクを探索で確認（2026年10月）。資料区分は探索時の判断で、本文とは未照合。','yearNotes':link.get('yearNotes') or '未確認','rawArchiveState':'not_downloaded'}
   acquisition={'state':'discovered','inputStatus':'discovered','method':'network','containerSha256':None,'memberPath':None,'memberIndex':None,'fetchedAt':None,'httpStatus':None,'sourceSha256':None}
   text={'status':'not_acquired','label':'unstructured_source_text','preview':None,'assetPath':None,'assetBytes':0,'assetSha256':None,'characters':0,'exportedCharacters':0,'truncated':False,'textSha256':None,'inputTextSha256':None,'extractionMethod':None}
   if hit and hit[1]['state']=='fetched':
    d,e=hit;raw=(d/e['file']).read_bytes()
    assert e['file']==f"objects/{e['sha256']}.bin" and digest(raw)==e['sha256'] and len(raw)==e['bytes'],'Collected original changed'
    acquisition.update(state='acquired',inputStatus='fetched',fetchedAt=e.get('fetchedAt') or e['attemptedAt'],httpStatus=e.get('httpStatus') or 200,sourceSha256=e['sha256'])
    review['rawArchiveState']='collected'
    ctype=(e.get('contentType') or '').lower()
    if raw[:5]==b'%PDF-':full,method=pdf_text(raw,pdftotext),PDF_METHOD
    elif raw[:4]==b'PK\x03\x04' and fmt in ('xlsx','xlsm') or raw[:8]==bytes.fromhex('d0cf11e0a1b11ae1') and fmt=='xls':full,method=sheet_text(raw),XLSX_METHOD
    elif fmt in ('html','htm') or 'html' in ctype:full,method=html_text(raw,url,e.get('contentType')),HTML_METHOD
    else:full,method=None,None
    text['inputTextSha256']=e['sha256']
    if full:
     first=full[:MAX_CHARS]
     doc={'acquisitionMethod':'network','characters':len(full),'containerSha256':None,'exportedCharacters':len(first),'extractionMethod':method,'inputTextSha256':e['sha256'],
      'label':'unstructured_source_text','memberIndex':None,'memberPath':None,'municipalityCode':code,'schemaVersion':1,'sourceId':sid,'sourceSha256':e['sha256'],
      'sourceUrl':url,'text':first,'textSha256':digest(first.encode()),'truncated':len(full)>len(first)}
     asset=encode(doc);(public/'documents'/f'{sid}.json').write_bytes(asset)
     text.update(status='available',preview=first[:1000],assetPath=f'documents/{sid}.json',assetBytes=len(asset),assetSha256=digest(asset),characters=len(full),
      exportedCharacters=len(first),truncated=doc['truncated'],textSha256=doc['textSha256'],extractionMethod=method)
     if doc['truncated']:
      truncated_docs+=1;full_sha=digest(full.encode());parts=[];start=len(first);part=2
      while start<len(full):
       chunk=full[start:start+MAX_CHARS]
       c={'exportedCharacters':len(chunk),'fullTextSha256':full_sha,'label':'unstructured_source_text_continuation','municipalityCode':code,'part':part,'schemaVersion':1,
        'sourceId':sid,'sourceSha256':e['sha256'],'sourceUrl':url,'startCharacter':start,'text':chunk,'textSha256':digest(chunk.encode())}
       a=encode(c);rel=f'documents/{sid}-{part}.json';(public/rel).write_bytes(a)
       parts.append({'part':part,'assetPath':rel,'assetBytes':len(a),'assetSha256':digest(a),'startCharacter':start,'exportedCharacters':len(chunk),'textSha256':c['textSha256']})
       start+=len(chunk);part+=1
      text.update(fullTextSha256=full_sha,continuations=parts);report['continuationParts']+=len(parts)
     report['text']+=1
    else:text['status']='no_readable_text';report['noText']+=1
    report['acquired']+=1;snapshot=max(snapshot,acquisition['fetchedAt'])
   elif hit and hit[1]['state'] in ('failed','blocked'):
    # No bytes were saved: the row stays a navigation-only link, marked as an access restriction (e.g. a redirect loop).
    acquisition.update(state='blocked',inputStatus='blocked')
    report['failed']+=1
   else:report['discovered']+=1
   sources.append({'id':sid,'url':url,'title':link['title'],'titleBasis':'official_link_label','format':fmt,'evaluationType':etype,'role':role,'navigationReview':review,
    'verification':{'status':'verified','basis':['都道府県の公式ドメイン上のページに掲載されたリンク（探索時に確認）'],'evidenceSourceId':None,'evidenceSha256':None,'evaluationRelevance':'verified'},
    'acquisition':acquisition,'text':text,'years':[]})
   report['sources']+=1
  acquired=sum(s['acquisition']['state']=='acquired' for s in sources)
  status='searched_not_found' if p.get('notFound') and not sources else 'fetched' if acquired else 'discovered'
  shard={'schemaVersion':1,'municipality':{'municipalityCode':code,'municipalityName':name,'prefectureCode':pc,'prefectureName':name},
   'discovery':{'status':status,'initialLook':True,'searchAttemptsCount':0,'coverageCompleteness':'not_established','omittedRejectedSources':0},
   'officialHomepage':None,'officialFallback':None,'officialDirectoryLinks':[],'evaluationPages':[s['id'] for s in sources if s['role']=='evaluation_landing_page'],'sources':sources}
  raw=encode(shard);(public/'prefectures'/f'{code}.json').write_bytes(raw)
  texts=sum(s['text']['status']=='available' for s in sources)
  entries.append({'municipalityCode':code,'municipalityName':name,'prefectureCode':pc,'prefectureName':name,'shardPath':f'prefectures/{code}.json','shardSha256':digest(raw),'shardBytes':len(raw),
   'discoveryStatus':status,'evidenceStatus':'text_available' if texts else 'sources_available' if sources else 'no_verified_sources',
   'evaluationPageCount':len(shard['evaluationPages']),'sourceCount':len(sources),'candidateCount':0,'acquiredCount':acquired,'textDocumentCount':texts,
   'substantiveTextDocumentCount':sum(s['text']['status']=='available' and s['role']=='evaluation_document' for s in sources),'officialHomepage':None,'officialFallback':None})
 rows=entries
 counts={'municipalities':len(rows),'municipalitiesWithAcquiredArtifacts':sum(r['acquiredCount']>0 for r in rows),'municipalitiesWithEvaluationPages':sum(r['evaluationPageCount']>0 for r in rows),
  'municipalitiesWithOfficialFallback':0,'municipalitiesWithOfficialHomepage':0,'municipalitiesWithReadableText':sum(r['textDocumentCount']>0 for r in rows),
  'municipalitiesWithSubstantiveEvaluationText':sum(r['substantiveTextDocumentCount']>0 for r in rows),'municipalitiesWithVerifiedSources':sum(r['sourceCount']>0 for r in rows),
  'acquiredSourceRows':sum(r['acquiredCount'] for r in rows),'candidateSourceRows':0,'verifiedSourceRows':sum(r['sourceCount'] for r in rows),'sourceRows':sum(r['sourceCount'] for r in rows),
  'substantiveEvaluationTextDocuments':sum(r['substantiveTextDocumentCount'] for r in rows),'textDocuments':sum(r['textDocumentCount'] for r in rows),'truncatedTextDocuments':truncated_docs}
 index={'schemaVersion':1,'scopeMunicipalities':47,'snapshotAt':snapshot,'counts':counts,'municipalities':sorted(entries,key=lambda r:r['municipalityCode'])}
 (public/'index.json').write_bytes(encode(index))
 return report

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--discovery',required=True);ap.add_argument('--collection',action='append',default=[]);ap.add_argument('--pdftotext',required=True)
 a=ap.parse_args();root=pathlib.Path(__file__).resolve().parent.parent
 print(json.dumps(build(root,pathlib.Path(a.discovery),[pathlib.Path(c) for c in a.collection],pathlib.Path(a.pdftotext)),ensure_ascii=False,indent=1))
