/** Replay explicitly reviewed continuous quotations; never infer dates, amounts or column joins. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {readCachedProof,type EnrichmentInput,type EnrichmentPatch} from '../../src/evaluations/enrichment-integration';
import {supplementalRecordSha256} from '../../src/evaluations/supplemental-integration';
const root=resolve(import.meta.dirname,'../../../..');
const read=async(p:string)=>JSON.parse(await readFile(join(root,p),'utf8'));
const manifest=await read('data/evaluations/enrichment-provenance.json');
const reviewed=await read('data/evaluations/enrichment-final-curated-clauses.json');
const datasets=new Map<string,any>();const patches=new Map<string,EnrichmentPatch>();
for(const row of reviewed.clauses){
 if(!datasets.has(row.code)){const e=manifest.baseIndex.municipalities.find((e:any)=>e.municipalityCode===row.code);assert.ok(e?.datasetPath);datasets.set(row.code,await read('apps/web/public/'+e.datasetPath));}
 const p=datasets.get(row.code).projects.find((p:any)=>p.id===row.projectId);assert.ok(p);assert.equal(p[row.field],null);
 assert.ok(['purpose','activities','outcomes'].includes(row.field));
 const proof=await readCachedProof(root,row.code,row.sourceId,row.quote,row.start);
 assert.equal(proof.sourceSha256,row.sourceSha256);assert.equal(proof.textSha256,row.textSha256);assert.equal(proof.sourceUrl,row.sourceUrl);
 const identity=await readCachedProof(root,row.code,row.sourceId,row.identity);
 let patch=patches.get(p.id);
 if(!patch){patch={id:'final-held-review-'+p.id,municipalityCode:row.code,projectId:p.id,beforeRecordSha256:supplementalRecordSha256(p),identity:{reason:'既存の原典URL・ハッシュと事業名又は保存個票の完全一致引用で同一事業を確認。欄名を含む原文は連続した引用として保持する。',proofs:[identity]},set:{}};patches.set(p.id,patch);}
 assert.ok(!Object.hasOwn(patch.set!,row.field),'Duplicate curated field');
 const proofs=[proof];
 if(row.contextProof)proofs.push(await readCachedProof(root,row.code,row.sourceId,row.contextProof));
 (patch.set as any)[row.field]={value:row.quote,proofs};
}
const input:EnrichmentInput={schemaVersion:1,generatedAt:'2026-10-25T23:00:00.000Z',patches:[...patches.values()]};
if(!process.argv[2])throw Error('Provide output JSON path');
await writeFile(resolve(process.argv[2]),JSON.stringify(input)+'\n');
console.log(JSON.stringify({records:input.patches.length,fields:reviewed.clauses.length,documents:new Set(reviewed.clauses.map((x:any)=>x.sourceId)).size}));
