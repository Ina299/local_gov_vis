/** Manually reviewed complete clauses only; cached sources, no network. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readCachedProof,type EnrichmentInput} from '../../src/evaluations/enrichment-integration';
import {supplementalRecordSha256} from '../../src/evaluations/supplemental-integration';
const root=resolve(import.meta.dirname,'../../../..');
const manifest=JSON.parse(await readFile(join(root,'data/evaluations/enrichment-provenance.json'),'utf8'));
const entry=manifest.baseIndex.municipalities.find((m:any)=>m.municipalityCode==='21221');
const dataset=JSON.parse(await readFile(join(root,'apps/web/public',entry.datasetPath),'utf8'));
const clauses=[
 ['行政相談事業','行政機関等の苦情や要望を聞き、その解決の促進と行政制度等の改善を図る。'],
 ['職員管理事務事業','職員の新規採用を計画的に行い、職員数の適正化及び職員管理を行う。'],
 ['秘書事務事業','市長、副市長の円滑な公務遂行及び自治功労表彰を実施する。'],
 ['災害支援事業','令和6年能登半島地震及び大雨災害に伴う避難所支援等のため、職員を派遣する。'],
 ['庁舎管理事業','庁舎及び設備の適切な維持管理を実施し、公務の円滑かつ適正な執行に努める。'],
 ['財産管理事業','市有財産や公用車等について、適切な維持管理を図る。'],
 ['議員研修事業','市議会議員の資質向上及び政策立案能力の強化を図るため、議員研修を実施する。'],
];
const input:EnrichmentInput={schemaVersion:1,generatedAt:'2026-10-25T00:00:00.000Z',patches:[]};
for(const [name,quote]of clauses){
 const sourceId=name==='議員研修事業'?'ed3196ee87afabaca9ffb2c8':'10e31a9d485160629a1bc333';
 const proof=await readCachedProof(root,'21221',sourceId,quote);
 const matches=dataset.projects.filter((p:any)=>p.projectName===name&&p.evidence.some((e:any)=>e.sourceUrl===proof.sourceUrl&&e.sha256===proof.sourceSha256&&e.rawText.includes(quote)));
 if(matches.length!==1||matches[0].purpose!==null)throw Error('Expected one unchanged empty-purpose record');
 const p=matches[0];
 const set:any={purpose:{value:quote,proofs:[proof]}};
 if(name==='庁舎管理事業'){
  const value='庁舎及び設備の適切な維持管理を行った。';
  if(p.outcomes!==null)throw Error('Outcome already filled');
  set.outcomes={value,proofs:[await readCachedProof(root,'21221',sourceId,value)]};
 }
 input.patches.push({id:'kaizu-held-followup-'+p.id,municipalityCode:'21221',projectId:p.id,beforeRecordSha256:supplementalRecordSha256(p),identity:{reason:'既存票と同じ原典URL・内容ハッシュで事業名と引用本文を照合。右側の課題・次年度方針が入る前の完結文のみ採用。',proofs:[proof]},set});
}
if(!process.argv[2])throw Error('Provide output JSON path');
await writeFile(resolve(process.argv[2]),JSON.stringify(input)+'\n');
console.log(JSON.stringify({records:input.patches.length,purpose:7,outcomes:1,documents:2}));
