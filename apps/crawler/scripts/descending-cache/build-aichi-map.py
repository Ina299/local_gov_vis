"""Regenerate pinned Aichi title map; extraction validation is performed by the crawler tests/validator."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[4]
source=Path(__file__).with_name('aichi-reviewed.json')
rows=json.loads(source.read_text())
assert len({(c['municipalityCode'],c['sourceId']) for c in rows})==len(rows)
for c in rows:
 assert len(c['sourceSha256'])==len(c['fullTextSha256'])==64
 assert len({(r['start'],r.get('year',c['year'])) for r in c['rows']})==len(c['rows'])
(root/'apps/crawler/src/evaluations/expansion/descending-aichi-map.ts').write_text('// Generated from reviewed hash-verified cached sources.\nexport const aichiRows = '+json.dumps(rows,ensure_ascii=False,indent=2)+';\n')
