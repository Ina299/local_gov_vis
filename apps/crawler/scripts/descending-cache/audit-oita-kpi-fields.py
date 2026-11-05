"""Offline attribution review; never generates projects or numerical values."""
import json, pathlib, hashlib, unicodedata, collections
root=pathlib.Path('data/evaluations/descending-layouts/44')
ledger=json.loads((root/'source-ledger.json').read_text());candidates=json.loads((root/'candidates.json').read_text())
norm=lambda s:''.join(unicodedata.normalize('NFKC',s).split())
projects=[p for p in candidates if p['municipalityCode']=='44209'];rows=[]
ids={'1954fd2f3956a0d25104ade4','0137b2aa2c7d024f32757bfa','2de21b4188e88a177e2f8a07','fd5c1cde2c0894e2d9fb8cf5'}
for src in ledger:
 if src['sourceId'] not in ids:continue
 text=json.loads(pathlib.Path('apps/web/public/evaluation-evidence/documents',src['sourceId']+'.json').read_text())['text']
 assert hashlib.sha256(text.encode()).hexdigest()==src['fullTextSha256'];units=src['layoutReview']['units']
 for u in units:
  if u['status'] not in ['layout_review','field_attribution_hold']:continue
  raw=u['name'];start=u['start'];assert text.encode('utf-16-le')[start*2:(start+len(raw.encode('utf-16-le'))//2)*2].decode('utf-16-le')==raw
  title=norm(raw[1:]);exact=[p['id']for p in projects if norm(p['projectName'])==title]
  embedded=[p['id']for p in projects if norm(p['projectName']) in title and len(norm(p['projectName']))>=6]
  indicator=title.startswith(('児童生徒','英語検定','（令和','年','大分県体力','保幼小・小中②','中高の連携会議回数')) or (title and title[0].isdigit())
  state='indicator_identity_hold' if indicator else 'project_binding_hold'
  reason='Indicator fragment or annual/count cell lacks a complete indicator-to-project and target/actual-column binding.' if indicator else 'Policy/action row has no proved individual-project identity binding. A printed program name or shared policy outcome alone cannot assign numerical fields to a candidate.'
  if exact:state='field_alignment_hold';reason='Exact title candidate exists, but this remaining row does not establish a bounded annual target/actual cell assignment; retain values unchanged.'
  rows.append({'sourceId':src['sourceId'],'sourceUrl':src['url'],'fullTextSha256':src['fullTextSha256'],'sourceSha256':src['sourceSha256'],'fetchedAt':src['fetchedAt'],'start':start,'rawText':raw,'state':state,'exactCandidateIds':exact,'embeddedNameCandidateIdsNotProofOfIdentity':embedded,'reason':reason,'requiredEvidence':'Explicit individual-project identity plus complete annual column/row association; original text coordinates or a separately bounded project sheet. No access authorization is inferred.'})
assert len(rows)==598,len(rows)
result={'scope':'Existing-project field attribution only; no new projects from KPI row counts.','reviewedRows':len(rows),'newProjects':0,'fieldsAdded':0,'existingFieldsChanged':0,'states':dict(collections.Counter(x['state']for x in rows)),'rows':rows}
(root/'kpi-field-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k!='rows'},ensure_ascii=False))
