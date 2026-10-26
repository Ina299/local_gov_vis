import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{fileURLToPath}from'node:url';
import{resolve,dirname,join}from'node:path';
import test from'node:test';
import{buildAssignment2Enrichment}from'../src/evaluations/enrichment/assignment2';
import{readEnrichmentBase,composeEnrichment}from'../src/evaluations/enrichment-integration';
import{sha256}from'../src/evaluations/national-integration';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const assignments=[['11243','62de523677a70b3ce1095a6f'],['01217','da6769ef0ea2756a3ef620a2'],['40224','e44263b49649b4a3adf0e7b6'],['29209','550d43ae8f707fc50af7b8c4'],['34214','0d1421e5bf4fc40d115c95b2'],['39412','6c150492b4c9efb9e907f56e'],['04212','ba71cc9bb5f15cfc90be8370'],['07446','eac7acd689c8016ad16063ac']].map(([code,documentId])=>({code,documentId,reason:'事業別本文照合',remainingScope:'不確定列は保持'}));
test('assignment2 enriches proven fields while preserving project identities, existing amounts and source years',async()=>{
 const generatedAt='2026-10-18T23:00:00.000Z';const result=await buildAssignment2Enrichment(root,assignments,generatedAt);
 assert.ok(result.manifest.patches.length>200);assert.equal(new Set(result.manifest.patches.map(p=>p.projectId)).size,result.manifest.patches.length);
 for(const patch of result.manifest.patches){for(const entry of Object.values(patch.set)){assert.ok(entry!.proofs.every(p=>p.quote===entry!.value));for(const proof of entry!.proofs){const doc=JSON.parse(readFileSync(join(root,'apps/web/public/evaluation-evidence/documents',proof.sourceId+'.json'),'utf8'));const m=/chars:(\d+)-(\d+)/.exec(proof.cell)!;assert.equal(doc.text.slice(+m[1],+m[2]),proof.quote);}}}
 const base=await readEnrichmentBase(root),bytes=Buffer.from(JSON.stringify(result.manifest)+'\n');const applied=await composeEnrichment(root,base,new Map([[sha256(bytes),bytes]]),generatedAt);
 assert.equal(applied.assets.index.primaryEvaluationRecords,base.index.primaryEvaluationRecords);assert.equal(applied.manifest.statistics.changedRecords,result.manifest.patches.length);
 for(const [code,changed]of applied.composed){const before=JSON.parse(base.shards.get(code)!.toString()),after=JSON.parse(changed.toString());assert.deepEqual(after.projects.map((p:any)=>p.id),before.projects.map((p:any)=>p.id));for(let i=0;i<before.projects.length;i++){assert.deepEqual(after.projects[i].amounts.slice(0,before.projects[i].amounts.length),before.projects[i].amounts);for(const field of ['indicators','ratings','evaluatedFiscalYear','evaluationYear'])assert.deepEqual(after.projects[i][field],before.projects[i][field]);}}
 assert.ok(result.manifest.patches.some(p=>p.append?.amounts.some(a=>a.value.kind==='personnel'&&a.value.fiscalYear===2024)));assert.ok(result.manifest.patches.some(p=>p.append?.amounts.some(a=>a.value.kind==='budget'&&a.value.fiscalYear===2026)));
 const names=result.manifest.patches.filter(p=>p.municipalityCode==='34214').flatMap(p=>p.identity.proofs.map(q=>q.quote));assert.ok(names.every(n=>!n.includes('空家バンク関係事業')),'Right-column future improvement must not become an outcome');
 const ikoma=result.manifest.patches.find(p=>p.identity.proofs.some(q=>q.quote.includes('地域脱炭素移行・再エネ推進事業')))!;assert.ok(ikoma.set.purpose!.value.includes('脱炭素先行地域'));assert.ok(!ikoma.set.purpose!.value.includes('太陽光発電、蓄電池等の設備導入'));
});
