import json,subprocess,sys,pathlib,datetime
pref=sys.argv[1]; root=pathlib.Path.cwd();pub=root/'apps/web/public'
master=subprocess.check_output(['git','ls-remote','origin','refs/heads/master'],text=True).split()[0]
assert master=='afa1c415e26f2f63d5d3f2c397b8dcf167f522a6', 'Master changed: re-audit before selection'
old=json.loads(subprocess.check_output(['git','show','6b7a84142daf2c600c54b7f9c248a517bc5861fc:apps/web/public/evaluations-index.json']))
old={m['municipalityCode']:m for m in old['municipalities']};idx=json.load(open(pub/'evaluations-index.json'));ei=json.load(open(pub/'evaluation-evidence/index.json'));e={m['municipalityCode']:m for m in ei['municipalities']}
ms=[];skip=[]
for m in idx['municipalities']:
 c=m['municipalityCode']
 if not c.startswith(pref):continue
 if m.get('datasetSha256')!=old.get(c,{}).get('datasetSha256'):skip.append({'municipalityCode':c,'municipalityName':m['municipalityName'],'reason':'Recent master dataset differs from common baseline'});continue
 ms.append({'municipalityCode':c,'municipalityName':m['municipalityName'],'datasetSha256':m.get('datasetSha256'),'evidenceShardSha256':e[c]['shardSha256']})
p=root/'data/evaluations/descending-offline'/pref;p.mkdir(parents=True,exist_ok=True)
json.dump({'prefecture':pref,'master':master,'comparisonBase':'6b7a84142daf2c600c54b7f9c248a517bc5861fc','selectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'unpublishedUserChanges':'not observable; collision freedom not guaranteed','municipalities':sorted(ms,key=lambda m:m['municipalityCode'],reverse=True),'skipped':skip},open(p/'cohort.json','w'),ensure_ascii=False,indent=2)
print(pref,len(ms),'selected',len(skip),'skipped')
