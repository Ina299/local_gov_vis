import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url));
test('assignment5 respects complete page boundaries, fiscal-year evidence, null-only writes and stable replay',()=>{
 const dir=mkdtempSync(join(tmpdir(),'enrich5-'));
 try{
  writeFileSync(join(dir,'assignment-5.json'),JSON.stringify([
   {code:'11230',documentId:'c2a94addac152dffa68daa21',evidenceQuotes:[],remainingScope:''},
   {code:'28203',documentId:'cca7de401e985e6fcac710c3',evidenceQuotes:[],remainingScope:''},
   {code:'22210',documentId:'91c10e34b6254116743de2bf',evidenceQuotes:[],remainingScope:''},
   {code:'11232',documentId:'9a1ae2fca89400f94992fd98',evidenceQuotes:[],remainingScope:''}
  ]));
  const run=()=>execFileSync(process.execPath,['--import','tsx',resolve(root,'apps/crawler/src/evaluations/enrichment/assignment5.ts'),root,dir],{cwd:root});run();
  const first=readFileSync(join(dir,'patches-5.json'));run();assert.deepEqual(readFileSync(join(dir,'patches-5.json')),first);
  const patches=JSON.parse(first.toString()).patches;assert.ok(patches.length>100);
  const publicDir=resolve(root,'apps/web/public'),manifest=resolve(root,'data/evaluations/enrichment-provenance.json');
  const index=existsSync(manifest)?JSON.parse(readFileSync(manifest,'utf8')).baseIndex:JSON.parse(readFileSync(resolve(publicDir,'evaluations-index.json'),'utf8'));
  for(const p of patches){const path=index.municipalities.find((x:{municipalityCode:string})=>x.municipalityCode===p.municipalityCode).datasetPath;const record=JSON.parse(readFileSync(resolve(publicDir,path),'utf8')).projects.find((x:{id:string})=>x.id===p.projectId);
   assert.equal(p.beforeRecordSha256,createHash('sha256').update(JSON.stringify(record)+'\n').digest('hex'));
   for(const [field,wrapped]of Object.entries(p.set??{})){assert.equal(record[field],null);const v=wrapped as {value:unknown;proofs:{quote:string}[]};if(typeof v.value==='string')assert.ok(v.proofs.some(q=>q.quote.includes(v.value as string)));}
   if(p.municipalityCode==='11230'){assert.notEqual(record.projectName,'配食サービス');assert.doesNotMatch(p.set.outcomes.value,/ごとに定める金額とする。 高齢者/);assert.ok(p.set.outcomes.value.endsWith('。'));}
   if(p.municipalityCode==='28203'&&p.set?.outcomes)assert.doesNotMatch(p.set.outcomes.value,/事務事業点検シート|観点（/);
   if(p.municipalityCode==='22210'&&p.set?.activities){assert.doesNotMatch(p.set.activities.value,/取組内容（予定）/);assert.equal(p.set.evaluatedFiscalYear.value,2025);}
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
