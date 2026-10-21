#!/usr/bin/env python3
"""Offline additive reviewed-link projection. Never downloads or invents raw source hashes."""
import argparse,gzip,hashlib,io,json,pathlib,re,shutil,urllib.parse
from evaluation_cache_overlay import apply_cache_overlay
from evaluation_collected_overlay import apply_collected_overlays
from evaluation_identity_corrections import apply_identity_corrections
BASE='d697c106f48610ef369c083cd2c041964209a3f4'
PREFIX='apps/web/public/evaluation-evidence/'
BASE_BUNDLE_SHA='d2ede75c99164d4918e606ac67f407bdb3c0df629ccb3a55d5f0749e0059bbce'
def encode(obj):return (json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()
def safe_url(value):
 if not isinstance(value,str):raise ValueError('URL must be a string')
 u=urllib.parse.urlsplit(value)
 if u.scheme not in ('https','http') or not u.hostname or u.username or u.password:raise ValueError('Unsafe source URL')
 return urllib.parse.urlunsplit((u.scheme,u.netloc,u.path,u.query,''))
def source_id(code,url):return digest(('reviewed-navigation-v1\0'+code+'\0'+url).encode())[:24]
def held_host(url,quarantined):
 host=urllib.parse.urlsplit(url).hostname.lower().removeprefix('www.')
 return host in {x.lower().removeprefix('www.') for x in quarantined}
def source(row,quarantined):
 code=row['municipalityCode'];url=safe_url(row['url']);verified=row['verification']=='verified'
 held=held_host(url,quarantined)
 if verified and held:raise ValueError('Quarantined host cannot be newly verified')
 fmt=row['format'];role='candidate'
 if verified:role=('evaluation_landing_page' if fmt=='html' else 'evaluation_document') if row['evaluationRelevant'] else 'supporting_document'
 sid=source_id(code,url)
 review={'method':'official_body_review' if verified else 'search_candidate','checkedAt':row['checkedAt'],'publisher':row['publisher'],'evidenceUrl':safe_url(row['evidenceUrl']),'originEvidenceUrl':safe_url(row['originEvidenceUrl']) if row.get('originEvidenceUrl') else None,'notes':row['notes'],'yearNotes':row['yearNotes'],'rawArchiveState':'not_downloaded'}
 return {'id':sid,'url':url,'title':row['title'],'titleBasis':'inventory_title','format':fmt,'evaluationType':row['evaluationType'],'role':role,'navigationReview':review,
 'verification':{'status':'verified' if verified else 'unverified','basis':['公式ページの本文・参照関係を確認（原本バイトは未保存）' if verified else '検索候補・本文または公式発信元の確認待ち'],'evidenceSourceId':None,'evidenceSha256':None,'evaluationRelevance':'verified' if verified and row['evaluationRelevant'] else 'not_established'},
 'acquisition':{'state':'blocked' if held else 'discovered','inputStatus':'blocked' if held else 'discovered','method':'network','containerSha256':None,'memberPath':None,'memberIndex':None,'fetchedAt':None,'httpStatus':None,'sourceSha256':None},
 'text':{'status':'not_acquired','label':'unstructured_source_text','preview':None,'assetPath':None,'assetBytes':0,'assetSha256':None,'characters':0,'exportedCharacters':0,'truncated':False,'textSha256':None,'inputTextSha256':None,'extractionMethod':None},'years':[]}
def merge_reviewed_source(city,s):
 """Upgrade only an empty, unacquired candidate; never validate old bytes by URL."""
 same=[x for x in city['sources'] if x['url']==s['url']]
 if not same:city['sources'].append(s);return 'added'
 if len(same)!=1 or s['verification']['status']!='verified':return 'preserved'
 old=same[0]
 if old['verification']['status']=='verified':return 'preserved'
 a=old['acquisition'];t=old['text']
 if a['state']!='discovered' or a.get('inputStatus') not in (None,'discovered') or any(a.get(k) is not None for k in ('sourceSha256','containerSha256','memberPath','memberIndex','fetchedAt','httpStatus')) or t['status']!='not_acquired' or any(t.get(k) is not None for k in ('assetPath','assetSha256','preview','textSha256','inputTextSha256','extractionMethod')) or any(t.get(k) for k in ('assetBytes','characters','exportedCharacters','truncated')) or old.get('years') or any(old['verification'].get(k) is not None for k in ('evidenceSourceId','evidenceSha256')):return 'retained_candidate_requires_archive_review'
 if any(x['verification'].get('evidenceSourceId')==old['id'] for x in city['sources'] if x['id']!=old['id']):return 'retained_candidate_has_dependents'
 assert s['acquisition']['state']=='discovered' and s['acquisition']['sourceSha256'] is None and s['text']['status']=='not_acquired'
 city['sources']=[s if x['id']==old['id'] else x for x in city['sources']]
 return 'upgraded_unacquired_candidate'
def build(root,reviews,out):
 payload=json.loads(reviews.read_text());assert payload['schemaVersion']==1 and payload['baseCommit']==BASE
 bundle=(root/'data/evaluations/navigation-base-v1.json.gz').read_bytes()
 if digest(bundle)!=BASE_BUNDLE_SHA:raise ValueError('Frozen base metadata hash mismatch')
 with gzip.GzipFile(fileobj=io.BytesIO(bundle)) as stream:raw=stream.read(64*1024*1024+1)
 if len(raw)>64*1024*1024:raise ValueError('Frozen base metadata exceeds limit')
 frozen=json.loads(raw)
 if frozen['baseCommit']!=BASE or frozen['schemaVersion']!=1:raise ValueError('Wrong frozen base')
 out.mkdir(parents=True,exist_ok=True)
 for name,content in frozen['files'].items():
  if name not in ('index.json','definitions.json') and not re.fullmatch(r'municipalities/[0-9]{5}\.json',name):raise ValueError('Unsafe frozen asset path')
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(content.encode())
 if digest((out/'index.json').read_bytes())!=frozen['baseIndexSha256']:raise ValueError('Wrong frozen index')
 # Text is unchanged. Validate existing bytes; copy only when making an isolated rebuild.
 for name,content in frozen['files'].items():
  if not name.startswith('municipalities/'):continue
  for cached_source in json.loads(content)['sources']:
   if cached_source['text']['status']!='available':continue
   rel=cached_source['text']['assetPath']
   if not re.fullmatch(r'documents/[a-f0-9]{24}\.json',rel):raise ValueError('Unsafe text asset path')
   original=root/PREFIX/rel;data=original.read_bytes()
   if len(data)!=cached_source['text']['assetBytes'] or digest(data)!=cached_source['text']['assetSha256']:raise ValueError('Frozen text asset changed')
   dest=out/rel
   if original.resolve()!=dest.resolve():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 index=json.loads((out/'index.json').read_text());apply_identity_corrections(root,out,index);entries={r['municipalityCode']:r for r in index['municipalities']};cities={};added=[];seen=set();upgraded=[];retained=[]
 # Later discovery rounds live in separate files; each keeps its own held-host list.
 extra=[json.loads(x.read_text(encoding='utf-8')) for x in sorted(root.glob('data/evaluations/navigation-reviewed-sources-*.json'))]
 for x in extra:assert x['schemaVersion']==1 and x['baseCommit']==BASE
 for row,quarantined in [(r,set(payload['quarantinedHosts'])) for r in payload['sources']]+[(r,set(x['quarantinedHosts'])) for x in extra for r in x['sources']]:
  code=row['municipalityCode'];entry=entries[code]
  if row['municipalityName']!=entry['municipalityName'] or row['prefectureCode']!=entry['prefectureCode']:raise ValueError('Municipal identity mismatch')
  assert row['verification'] in ('verified','candidate') and isinstance(row['evaluationRelevant'],bool)
  for field in ('title','publisher','notes','yearNotes','checkedAt'):assert isinstance(row[field],str) and len(row[field])<=4000
  s=source(row,quarantined);key=(code,s['url'])
  if key in seen:raise ValueError('Duplicate review source')
  seen.add(key)
  if code not in cities:cities[code]=json.loads((out/entry['shardPath']).read_text())
  city=cities[code]
  decision=merge_reviewed_source(city,s)
  if decision in ('added','upgraded_unacquired_candidate'):added.append((code,s))
  if decision=='upgraded_unacquired_candidate':upgraded.append({'municipalityCode':code,'url':s['url']})
  elif decision.startswith('retained_candidate'):retained.append({'municipalityCode':code,'url':s['url'],'reason':decision})
 for code,city in cities.items():
  entry=entries[code];ss=city['sources'];city['evaluationPages']=[s['id'] for s in ss if s['role']=='evaluation_landing_page' and s['verification']['status']=='verified']
  if ss and city['discovery']['status'] in ('not_searched','searched_not_found'):city['discovery']['status']='discovered'
  city['discovery']['coverageCompleteness']='not_established'
  entry.update(discoveryStatus=city['discovery']['status'],evaluationPageCount=len(city['evaluationPages']),sourceCount=sum(s['verification']['status']=='verified' for s in ss),candidateCount=sum(s['verification']['status']!='verified' for s in ss),acquiredCount=sum(s['acquisition']['state']=='acquired' for s in ss),textDocumentCount=sum(s['text']['status']=='available' for s in ss),substantiveTextDocumentCount=sum(s['text']['status']=='available' and s['role']=='evaluation_document' for s in ss))
  entry['evidenceStatus']='text_available' if entry['textDocumentCount'] else 'sources_available' if entry['sourceCount'] else 'official_fallback_only' if entry['officialHomepage'] or entry['officialFallback'] else 'no_verified_sources'
  raw=encode(city);(out/entry['shardPath']).write_bytes(raw);entry['shardBytes']=len(raw);entry['shardSha256']=digest(raw)
 cache_report=apply_cache_overlay(root,out,index)
 collected_report=apply_collected_overlays(root,out,index)
 rows=index['municipalities'];counts=index['counts']
 counts['municipalitiesWithOfficialFallback']=sum(bool(e['officialFallback']) for e in rows)
 counts['municipalitiesWithOfficialHomepage']=sum(bool(e['officialHomepage']) for e in rows)
 for key,field in [('municipalitiesWithAcquiredArtifacts','acquiredCount'),('municipalitiesWithEvaluationPages','evaluationPageCount'),('municipalitiesWithReadableText','textDocumentCount'),('municipalitiesWithSubstantiveEvaluationText','substantiveTextDocumentCount'),('municipalitiesWithVerifiedSources','sourceCount')]:counts[key]=sum(r[field]>0 for r in rows)
 for key,field in [('acquiredSourceRows','acquiredCount'),('candidateSourceRows','candidateCount'),('verifiedSourceRows','sourceCount'),('textDocuments','textDocumentCount'),('substantiveEvaluationTextDocuments','substantiveTextDocumentCount')]:counts[key]=sum(r[field] for r in rows)
 counts['sourceRows']=counts['candidateSourceRows']+counts['verifiedSourceRows'];counts['reviewedNavigationSources']=sum(s['verification']['status']=='verified' for _,s in added);counts['reviewedNavigationMunicipalities']=len({code for code,s in added if s['verification']['status']=='verified'})
 index['snapshotAt']=max([index['snapshotAt'],payload['snapshotAt']]+[x['snapshotAt'] for x in extra]);(out/'index.json').write_bytes(encode(index))
 definitions=json.loads((out/'definitions.json').read_text());definitions['counts']=dict(counts);definitions['substantiveEvaluationText']='Acquired, identity-verified evaluation-document bodies, including explicitly reviewed substantive HTML project tables as well as non-HTML documents. Landing pages and supporting guidelines are excluded. This is unstructured source access, not complete or numerically normalized coverage.';definitions['reviewedNavigation']='Additional links reviewed through official page content; marked separately. No original bytes or full text stored; sourceSha256 is null and acquisition is discovered/blocked. Search-only and delegated-host identity-pending links remain candidates.';definitions['evaluationLandingPage']='Official evaluation entrypoint verified either from a hash-checked archived page or an explicitly labeled official-page review. This is not proof of downloading its linked reports.';(out/'definitions.json').write_bytes(encode(definitions))
 return {'baseCommit':BASE,'indexSha256':digest((out/'index.json').read_bytes()),'addedSourceRows':len(added),'addedMunicipalities':len({c for c,s in added}),'counts':counts,'downloadedRawSources':0,'textAssetsAdded':cache_report['textAssets'],'cachedReview':cache_report,'collected':collected_report,'upgradedUnacquiredCandidates':upgraded,'retainedCandidatesRequiringReview':retained}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--reviews',default='data/evaluations/navigation-reviewed-sources.json');p.add_argument('--out-public',default=PREFIX);a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1];print(json.dumps(build(root,root/a.reviews,root/a.out_public),ensure_ascii=False,indent=2))
