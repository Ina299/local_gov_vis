import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {verifiedFullText} from '../src/evaluations/expansion/fulltext';
import {sha256} from '../src/evaluations/national-integration';
import {reviewContinuationPhase} from '../src/review-continuation-phase';
const root=resolve(import.meta.dirname,'../../..');
test('continuation binding rejects wrong identity, metadata, ordering, offsets, bytes and complete hash',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'continuation-integrity-'));
 try{
  await mkdir(join(dir,'documents'));
  const first={text:'始😀',textSha256:sha256(Buffer.from('始😀')),sourceId:'abc',sourceUrl:'https://example.invalid/a.pdf',sourceSha256:'a'.repeat(64),municipalityCode:'11243'};
  const whole=sha256(Buffer.from('始😀続終'));
  const part={...first,text:'続終',textSha256:sha256(Buffer.from('続終')),part:2,startCharacter:2,exportedCharacters:2,fullTextSha256:whole};
  const bytes=Buffer.from(JSON.stringify(part));
  const c={part:2,assetPath:'documents/abc-2.json',assetBytes:bytes.length,assetSha256:sha256(bytes),startCharacter:2,exportedCharacters:2,textSha256:part.textSha256};
  const source={id:'abc',url:first.sourceUrl,acquisition:{sourceSha256:first.sourceSha256},text:{characters:4,exportedCharacters:2,truncated:true,textSha256:first.textSha256,fullTextSha256:whole,continuations:[c]}};
  await writeFile(join(dir,c.assetPath),bytes);
  assert.deepEqual(await verifiedFullText(dir,source,first,'11243'),{text:'始😀続終',complete:true});
  for(const field of ['sourceId','sourceUrl','sourceSha256','municipalityCode','textSha256','fullTextSha256','part','startCharacter','exportedCharacters']) {
   const bad={...part,[field]:typeof part[field as keyof typeof part]==='number'?999:'wrong'};
   const b=Buffer.from(JSON.stringify(bad));await writeFile(join(dir,c.assetPath),b);
   const s=structuredClone(source);s.text.continuations[0].assetBytes=b.length;s.text.continuations[0].assetSha256=sha256(b);
   await assert.rejects(verifiedFullText(dir,s,first,'11243'),undefined,field);
  }
  await writeFile(join(dir,c.assetPath),bytes);
  for(const field of ['assetBytes','assetSha256','startCharacter','exportedCharacters','part','textSha256']) {
   const s=structuredClone(source);Object.assign(s.text.continuations[0],{[field]:typeof c[field as keyof typeof c]==='number'?999:'wrong'});
   await assert.rejects(verifiedFullText(dir,s,first,'11243'),undefined,field);
  }
  await assert.rejects(verifiedFullText(dir,{...source,text:{...source.text,fullTextSha256:'wrong'}},first,'11243'));
  await assert.rejects(verifiedFullText(dir,source,{...first,text:'改変'},'11243'));
  await rm(join(dir,c.assetPath));await assert.rejects(verifiedFullText(dir,source,first,'11243'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('bounded continuation phase replays every accepted record and source disposition without site access',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'continuation-replay-'));
 try{
  await reviewContinuationPhase(join(dir,'review'));
  const audit=JSON.parse(await readFile(join(dir,'review/audit.json'),'utf8'));
  assert.equal(audit.recordsAdded,301);assert.equal(audit.existingFieldsAdded,0);assert.equal(audit.sourceRequests,0);
  assert.equal(audit.inventoryEntries,21);assert.equal(audit.verifiedTextAssets,19);
  assert.deepEqual(audit,JSON.parse(await readFile(join(root,'data/evaluations/continuation-review.json'),'utf8')));
  const expected={'01202':11,'11243':62,'12204':20,'37206':208};
  for(const [code,count] of Object.entries(expected)) {
   const d=JSON.parse(await readFile(join(dir,`review/inputs/${code}.json`),'utf8'));assert.equal(d.projects.length,count);
   for(const p of d.projects) {assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);}
   if(code==='11243')for(const p of d.projects){assert.equal(p.evaluationYear,2026);assert.equal(p.evaluatedFiscalYear,2025);}
   if(code==='37206')assert.ok(d.projects.some((p:any)=>Number(p.evidence[0].cell.split(':')[2].split('-')[0])>120000));
  }
  for(const id of ['67c3262684f9e2cb2c7b0a4b','a86ace3177f71817528ab4e8'])assert.match(audit.reviews.find((r:any)=>r.sourceId===id).reason,/No readable cached text/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('reviewed footer positions fail closed when a footer changes and complete volume gates remain enforced',async()=>{
 const {reviewContinuationSource}=await import('../src/evaluations/expansion/continuation-phase');
 const {sanukiFooterBindings}=await import('../src/evaluations/expansion/sanuki-footer-bindings');
 const base=join(root,'apps/web/public/evaluation-evidence');
 const metadata=JSON.parse(await readFile(join(base,'municipalities/37206.json'),'utf8'));
 const inputs=[];
 for(const id of ['dc00fdfdacc88d812fad19db','df52ad93846580efd42de26e']) {
  const s=metadata.sources.find((s:any)=>s.id===id),doc=JSON.parse(await readFile(join(base,s.text.assetPath),'utf8'));
  const whole=await verifiedFullText(base,s,doc,'37206');
  inputs.push({municipalityCode:'37206',municipalityName:'さぬき市',sourceId:id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:doc.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf' as const,text:whole.text,truncated:!whole.complete});
 }
 const good=reviewContinuationSource(inputs[0],'',inputs);assert.ok(good.projects.some(p=>p.evidence[0].cell?.startsWith('extracted-text:chars:10763-')));
 const binding=sanukiFooterBindings[`${inputs[0].sourceId}:10763`];
 const offset=10763+binding.firstOffset+1,t=inputs[0].text;
 const bad={...inputs[0],text:t.slice(0,offset)+'999'+t.slice(offset+3)};
 const result=reviewContinuationSource(bad,'',[bad,inputs[1]]);
 assert.ok(!result.projects.some(p=>p.evidence[0].cell?.startsWith('extracted-text:chars:10763-')));
 assert.ok(result.holds.some(h=>h.unit==='chars:10763'));
 for(const sourceId of ['e77c0e1cc6cbbc4834ff478b','15d7a81b4fe97d1c76a9f9f9'])assert.equal(reviewContinuationSource({...bad,sourceId,truncated:true},'',[]).projects.length,0);
});
