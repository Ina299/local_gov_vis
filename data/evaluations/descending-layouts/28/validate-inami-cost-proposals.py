"""Offline checks for isolated actual-cost proposals; never mutates candidates."""
from pathlib import Path
import copy
import hashlib
import json
import re

here = Path(__file__).resolve().parent
root = here.parents[3]
evidence = root / 'apps/web/public/evaluation-evidence'
sid = '5ab9e8fdc9ee5aee927abad4'
meta = json.loads((evidence / 'municipalities/28381.json').read_text())
src = next(s for s in meta['sources'] if s['id'] == sid)
info = src['text']
assert not info.get('continuations')
raw = (evidence / info['assetPath']).read_bytes()
assert len(raw) == info['assetBytes']
assert hashlib.sha256(raw).hexdigest() == info['assetSha256']
doc = json.loads(raw)
assert doc['truncated'] is False and info['truncated'] is False
text = doc['text']
assert len(text) == info['characters'] == info['exportedCharacters']
assert hashlib.sha256(text.encode()).hexdigest() == info['textSha256']
assert doc['sourceId'] == sid and doc['sourceUrl'] == src['url']
assert doc['sourceSha256'] == src['acquisition']['sourceSha256']
units = text.encode('utf-16-le')
candidates = {x['id']: x for x in json.loads((here / 'candidates.json').read_text())}
rows = json.loads((here / 'inami-actual-cost-proposals.json').read_text())
assert len(rows) == len({x['candidateId'] for x in rows}) == 71

def validate(x):
    assert x['status'] == 'validated_field_proposal_not_applied'
    assert x['sourceId'] == sid and x['municipalityCode'] == '28381'
    assert x['sourceUrl'] == src['url']
    assert x['sourceSha256'] == src['acquisition']['sourceSha256']
    assert x['fetchedAt'] == src['acquisition']['fetchedAt']
    assert x['fullTextSha256'] == hashlib.sha256(text.encode()).hexdigest()
    assert x['amountType'] == 'actual' and x['currency'] == 'JPY'
    c = candidates[x['candidateId']]
    assert c['municipalityCode'] == '28381' and c['projectName'] == x['projectName']
    assert c['evaluatedFiscalYear'] == x['fiscalYear'] == 2024 and not c['amounts']
    assert x['sourceLabel'] == '事業費' and x['reportingContext'] == '令和６年度決算'
    qs = x['quotes']
    assert len(qs) == 3 and qs[0]['rawText'] == x['reportingContext']
    for q in qs:
        assert units[q['start'] * 2:q['end'] * 2].decode('utf-16-le') == q['rawText']
    start = qs[0]['start']
    tail = units[start * 2:].decode('utf-16-le')
    following = tail.find('令和６年度決算', 7)
    end = start + len(tail[:following].encode('utf-16-le')) // 2 if following >= 0 else len(units) // 2
    assert all(start <= q['start'] < q['end'] <= end for q in qs)
    title = c['evidence'][0]
    title_match = re.fullmatch(r'extracted-text:chars:(\d+)-(\d+)', title['cell'])
    assert title_match and start <= int(title_match[1]) < int(title_match[2]) <= end
    assert title['sourceUrl'] == src['url'] and title['sha256'] == x['sourceSha256']
    assert units[int(title_match[1]) * 2:int(title_match[2]) * 2].decode('utf-16-le') == title['rawText']
    header = re.fullmatch(r'事業費\s+([0-9,]+)\s*円', qs[1]['rawText'])
    assert header and int(header[1].replace(',', '')) == x['amountYen']
    footer = re.fullmatch(r'予算現額\s+([\d,]+)\s*円\s+([\d,]+)\s*円\s+(?:△\s*)?([\d,]+)\s*円\s+決算額\s+([\d,]+)\s*円\s+([\d,]+)\s*円\s+(?:△\s*)?([\d,]+)\s*円', qs[2]['rawText'])
    assert footer and int(footer[4].replace(',', '')) == x['amountYen']
    headings = units[max(start, qs[2]['start'] - 180) * 2:qs[2]['start'] * 2].decode('utf-16-le')
    assert '当年度' in headings and '前年度' in headings
    assert headings.index('当年度') < headings.index('前年度')

for row in rows:
    validate(row)
mutations = [('amountYen', -1), ('fiscalYear', 2025), ('sourceSha256', 'wrong'), ('fetchedAt', 'wrong'), ('amountType', 'budget'), ('candidateId', rows[1]['candidateId'])]
for key, value in mutations:
    bad = copy.deepcopy(rows[0])
    bad[key] = value
    try:
        validate(bad)
    except (AssertionError, KeyError):
        pass
    else:
        raise AssertionError('Did not reject mutation: ' + key)
bad = copy.deepcopy(rows[0])
bad['quotes'][1]['start'] += 1
try:
    validate(bad)
except (AssertionError, UnicodeDecodeError):
    pass
else:
    raise AssertionError('Did not reject quote offset mutation')
holds = json.loads((here / 'inami-amount-holds.json').read_text())
assert len(holds) == 7
for h in holds:
    q = h['quote']
    assert units[q['start'] * 2:q['end'] * 2].decode('utf-16-le') == q['rawText']
    assert h['sourceId'] == sid and h['sourceUrl'] == src['url']
    assert h['sourceSha256'] == src['acquisition']['sourceSha256']
    assert h['fullTextSha256'] == hashlib.sha256(text.encode()).hexdigest()
    assert h['fetchedAt'] == src['acquisition']['fetchedAt']
    for value in h.get('unresolvedPrintedValues', {}).values():
        assert value is None or value in q['rawText']
print(json.dumps(dict(heldRowsWithExactEvidence=7, validatedFieldProposals=71, validatedQuotes=213, negativeCases=7, appliedFields=0, productionRecordsAdded=0, municipalRequests=0)))
