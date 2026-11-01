import json,re,hashlib,pathlib
names=pathlib.Path(__file__).with_name('bungotakada-kpi-titles.txt').read_text().splitlines();cs=[]
for id,years in [('1954fd2f3956a0d25104ade4',[2020,2021]),('0137b2aa2c7d024f32757bfa',[2022]),('2de21b4188e88a177e2f8a07',[2023]),('fd5c1cde2c0894e2d9fb8cf5',[2024])]:
 t=json.load(open('apps/web/public/evaluation-evidence/documents/'+id+'.json'))['text'];rows=[]
 for name in names:
  matches=list(re.finditer('^[①-⑳]'+re.escape(name)+'$',t,re.M));assert matches,(id,name)
  m=matches[0];rows.append({'name':name,'raw':m.group(),'start':len(t[:m.start()].encode('utf-16-le'))//2,'repeatCount':len(matches)})
 cs.append({'id':id,'years':years,'fullTextSha256':hashlib.sha256(t.encode()).hexdigest(),'rows':rows,'proofs':['R'+str(y-2018)+'実績値'for y in years]});assert all(p in t for p in cs[-1]['proofs'])
pathlib.Path('apps/crawler/src/evaluations/expansion/descending-bungotakada-kpi-map.ts').write_text('export const bungoKpiRows = '+json.dumps(cs,ensure_ascii=False,indent=2)+';\n');print([len(c['rows'])for c in cs])
