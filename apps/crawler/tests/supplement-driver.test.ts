import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { sha256 } from '../src/evaluations/national-integration';
import { SUPPLEMENTAL_MANIFEST, type SupplementalManifest, type SupplementalInput } from '../src/evaluations/supplemental-integration';
import type { EvaluationDataset } from '../../web/src/types/evaluation';

test('supplement driver distinguishes PDF members sharing one ZIP URL by their content hashes',()=>{
 const scratch=mkdtempSync(join(tmpdir(),'evaluation-zip-members-'));
 try {
  const output=join(scratch,'candidates');
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('../src/extract-cached-evaluation-supplements.ts',import.meta.url)),
   '--output-dir',output,'--generated-at','2026-10-18T00:00:00.000Z','--codes','33209'],{stdio:'pipe'});
  const data=JSON.parse(readFileSync(join(output,'33209.json'),'utf8')) as EvaluationDataset;
  const docs=data.sources.flatMap(s=>s.documents);
  const shared=docs.filter(d=>d.url.endsWith('54636_180577_misc.zip'));
  assert.ok(shared.length>1);
  assert.equal(new Set(shared.map(d=>d.sha256)).size,shared.length);
  assert.equal(data.sources.reduce((n,s)=>n+s.extractedProjects,0),data.projects.length);
  for(const d of docs)assert.equal(d.projectCount,data.projects.filter(p=>p.evidence[0].sourceUrl===d.url&&p.evidence[0].sha256===d.sha256).length);
 }finally{rmSync(scratch,{recursive:true,force:true});}
});

// Import time can differ from extraction time; replay the generatedAt stored in each
// immutable input, rather than substituting the overlay's publication timestamp.
test('published supplemental inputs reproduce byte-for-byte from every hash-checked cached source',t=>{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
 let manifest:SupplementalManifest;
 try{manifest=JSON.parse(readFileSync(join(root,SUPPLEMENTAL_MANIFEST),'utf8')) as SupplementalManifest;}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){t.skip('Supplemental provenance has not been imported yet');return;}throw error;}
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.kind,'supplemental_evaluation_overlay');
 assert.ok(manifest.batches.length>0,'Published provenance must contain a batch');
 const scratch=mkdtempSync(join(tmpdir(),'supplement-reproduction-'));
 let verified=0;
 try{
  for(const [batchIndex,batch]of manifest.batches.entries()){
   assert.ok(batch.inputs.length>0,'Published batch must contain inputs');
   const groups=new Map<string,SupplementalInput[]>();
   const codes=new Set<string>();
   for(const input of batch.inputs){
    assert.match(input.municipalityCode,/^\d{5}$/);
    assert.match(input.sha256,/^[a-f0-9]{64}$/);
    assert.equal(input.path,`data/evaluations/supplemental-inputs/${input.sha256}.json`);
    assert.ok(!codes.has(input.municipalityCode),'Repeated municipality in one batch');codes.add(input.municipalityCode);
    const bytes=readFileSync(join(root,input.path));
    assert.equal(bytes.length,input.bytes,`Stored bytes: ${input.municipalityCode}`);
    assert.equal(sha256(bytes),input.sha256,`Stored SHA: ${input.municipalityCode}`);
    const saved=JSON.parse(bytes.toString()) as EvaluationDataset;
    assert.ok(Number.isFinite(Date.parse(saved.generatedAt)),'Input extraction timestamp must be valid');
    const group=groups.get(saved.generatedAt)??[];group.push(input);groups.set(saved.generatedAt,group);
   }
   let groupIndex=0;
   for(const [generatedAt,inputs]of groups){
    const output=join(scratch,`batch-${batchIndex}-group-${groupIndex++}`,'shards');
    execFileSync(process.execPath,['--import','tsx',join(root,'apps/crawler/src/extract-cached-evaluation-supplements.ts'),
      '--output-dir',output,'--generated-at',generatedAt,'--codes',inputs.map(i=>i.municipalityCode).join(',')],{cwd:root,stdio:'pipe',timeout:300_000});
    for(const input of inputs){
     const reproduced=readFileSync(join(output,`${input.municipalityCode}.json`));
     assert.equal(reproduced.length,input.bytes,`Reproduced bytes: ${input.municipalityCode}`);
     assert.equal(sha256(reproduced),input.sha256,`Reproduced SHA: ${input.municipalityCode}`);
     assert.deepEqual(reproduced,readFileSync(join(root,input.path)),`Input differs: ${input.municipalityCode}`);
     verified++;
    }
   }
  }
  assert.equal(verified,manifest.batches.reduce((n,b)=>n+b.inputs.length,0));
 }finally{rmSync(scratch,{recursive:true,force:true});}
});
