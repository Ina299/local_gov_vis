"""Read-only reference/coverage triage; only writes isolated audit sidecars."""
import json,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1];pub=root/'apps/web/public';base=pub/'evaluation-evidence';out=root/'data/evaluations/descending-offline';idx={r['municipalityCode']:r for r in json.load(open(pub/'evaluations-index.json'))['municipalities']}
for directory in sorted(out.glob('[0-9][0-9]'),reverse=True):
 ledger=json.load(open(directory/'source-ledger.json'));counts=collections.Counter();references={};rows=[]
 for c in json.load(open(directory/'cohort.json'))['municipalities']:
  m=idx[c['municipalityCode']]
  for p in (json.load(open(pub/m['datasetPath']))['projects'] if m.get('datasetPath') else []):
   for k in {(e['sourceUrl'],e['sha256']) for e in p['evidence']}:references.setdefault((c['municipalityCode'],*k),set()).add(p['id'])
 for r in ledger:
  n=len(references.get((r['municipalityCode'],r['url'],r.get('sourceSha256')),set()));status=r['status']
  if status=='unsupported_layout' and n:status='referenced_coverage_unverified'
  row={k:r[k] for k in ['municipalityCode','sourceId','url','title']};row.update(parserDisposition=r['status'],coverageDisposition=status,existingReferencedRecords=n,coverageComplete=False)
  # No source is deemed fully covered solely because a parser emitted duplicates.
  counts[status]+=1;rows.append(row)
 json.dump({'counts':dict(counts),'sources':rows},open(directory/'coverage-review.json','w'),ensure_ascii=False,separators=(',',':'))
