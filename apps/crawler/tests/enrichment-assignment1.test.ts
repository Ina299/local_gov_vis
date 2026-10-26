import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('assignment1 enriches original null fields and retains complete wrapped sentences, exact proofs and separated target years',()=>{
 const dir=mkdtempSync(join(tmpdir(),'evaluation-enrichment-one-'));
 try{
  const ids=['02dca088713ec6500f0c3f19','f55d2cad1aa84843ebbb6e32','20331382b8846b97fab9efe9','db0d1e8fda886d55fbade986','d1974300534b35b0538a789e','bb6bf0997e1a47ba69ea6baa'];
  ids.push('57705f22190cb81477f68436');
  const docs=ids.map(id=>read(join(root,'apps/web/public/evaluation-evidence/documents',id+'.json')));
  writeFileSync(join(dir,'assignment-1.json'),JSON.stringify(docs.map(d=>({documentId:d.sourceId,code:d.municipalityCode,status:'already_partial',reason:'既存個票の未入力欄を原文に照合して検証する。',evidenceQuotes:[d.text.slice(0,100)],remainingScope:'未分離欄を検証する。'}))));
  const command=join(root,'apps/crawler/src/evaluations/enrichment/assignment1.mjs');execFileSync(process.execPath,[command,root,dir]);
  const bytes=readFileSync(join(dir,'patches-1.json'),'utf8');execFileSync(process.execPath,[command,root,dir]);assert.equal(readFileSync(join(dir,'patches-1.json'),'utf8'),bytes);
  const patches=JSON.parse(bytes).patches;
  const consult=patches.find((p:any)=>p.projectId==='cached-40220-0d08a60894972267c7a0a7a9');assert.ok(consult.set.activities.value.startsWith('乳幼児から'));assert.ok(consult.set.activities.value.endsWith('受ける。'));assert.notEqual(consult.set.activities.value,'受ける。');
  const child=patches.find((p:any)=>p.projectId==='cached-40220-3ff64a687e74b3abb5757c88');assert.ok(child.set.activities.value.startsWith('子ども相談支援センター'));
  const hofu=patches.filter((p:any)=>p.municipalityCode==='35206');assert.equal(hofu.length,242);for(const code of ['30','50','233'])assert.ok(!hofu.some((p:any)=>p.projectId.endsWith(':hofu-r7:'+code)));
  const ishigaki=patches.filter((p:any)=>p.municipalityCode==='47207');assert.equal(ishigaki.length,31);for(const p of ishigaki){assert.ok(!p.set.activities.value.includes('めざす'));assert.ok(p.set.activities.value.startsWith('事業\n'));}assert.ok(ishigaki.find((p:any)=>p.projectId.endsWith('-p18')).set.activities.value.includes('伊原間公民館'));assert.ok(ishigaki.find((p:any)=>p.projectId.endsWith('-p50')).set.outcomes.value.startsWith('「養殖魚類種苗'));assert.equal(ishigaki.find((p:any)=>p.projectId.endsWith('-p14')).set.outcomes,undefined);
  assert.ok(!patches.find((p:any)=>p.municipalityCode==='20202'&&p.projectId.endsWith('-p84')).set.purpose.value.includes('\n内容'));
  const farming=patches.find((p:any)=>p.municipalityCode==='02206');assert.equal(farming.set.evaluatedFiscalYear.value,2024);assert.equal(farming.set.evaluationYear.value,2025);assert.ok(farming.append.indicators.every((i:any)=>i.value.fiscalYear===2024?i.value.target===null:i.value.fiscalYear===2026&&i.value.actual===null));
  const provenance=join(root,'data/evaluations/enrichment-provenance.json');const index=existsSync(provenance)?read(provenance).baseIndex:read(join(root,'apps/web/public/evaluations-index.json'));
  const original=new Map(index.municipalities.filter((r:any)=>r.datasetPath).flatMap((r:any)=>read(join(root,'apps/web/public',r.datasetPath)).projects.map((p:any)=>[p.id,p])));
  for(const patch of patches){const prior:any=original.get(patch.projectId);assert.equal(createHash('sha256').update(JSON.stringify(prior)+'\n').digest('hex'),patch.beforeRecordSha256);for(const key of Object.keys(patch.set))assert.equal(prior[key],null);for(const list of Object.values(patch.append??{}) as any[][])for(const entry of list){assert.equal(typeof entry.value.evidence.fetchedAt,'string');assert.equal(entry.value.evidence.format,'pdf');}const proofs=[...patch.identity.proofs,...Object.values(patch.set).flatMap((v:any)=>v.proofs),...Object.values(patch.append??{}).flatMap((a:any)=>a.flatMap((v:any)=>v.proofs))];for(const proof of proofs){const d=docs.find(d=>d.sourceId===proof.sourceId);assert.ok(d.text.includes(proof.quote));assert.ok(proof.quote.trim().length>=8);}}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
