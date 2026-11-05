import {assertBoundedCandidate} from './evaluations/expansion/descending-bounded-validation';
import {boundedSourceScope} from './evaluations/expansion/descending-bounded-review';
import {cachedSourceFormat} from './evaluations/expansion/cached-source-format';
/** Independently checks saved candidates and writes isolated import-shaped inputs, never public assets. */
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './evaluations/national-integration';
import {fullText} from './evaluations/expansion/fulltext';
import {createRequire} from 'node:module';
const {parseEvaluationDataset}=createRequire(import.meta.url)('../../web/src/lib/evaluations.ts');
import type {ProjectEvaluation} from '../../web/src/types/evaluation';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),pub=join(root,'apps/web/public'),base=join(pub,'evaluation-evidence'),dir=join(root,process.argv[2]==='--layouts'?'data/evaluations/descending-layouts':'data/evaluations/descending-offline');
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8')),ei=await read(join(base,'index.json')),index=await read(join(pub,'evaluations-index.json'));let total=0,evidenceCount=0;
for(const pref of (await readdir(dir)).filter(p=>/^\d{2}$/.test(p)).sort().reverse()){
 const out=join(dir,pref),ps:ProjectEvaluation[]=await read(join(out,'candidates.json')),cohort=await read(join(out,'cohort.json')),sources=new Map<string,any>();
 for(const c of cohort.municipalities){const i=index.municipalities.find((x:any)=>x.municipalityCode===c.municipalityCode),e=ei.municipalities.find((x:any)=>x.municipalityCode===c.municipalityCode);assert.equal(i.datasetSha256,c.datasetSha256);assert.equal(e.shardSha256,c.evidenceShardSha256);const mb=await readFile(join(base,e.shardPath));assert.equal(sha256(mb),e.shardSha256);for(const s of JSON.parse(mb.toString()).sources)sources.set(c.municipalityCode+'\n'+s.url,s);}
 const checked=new Map<string,string>(),formats=new Map<string,string>(),ids=new Set<string>();
 for(const p of ps){assert.ok(!ids.has(p.id));ids.add(p.id);assert.ok(p.evaluationYear!==null||p.evaluatedFiscalYear!==null);assert.ok(cohort.municipalities.some((c:any)=>c.municipalityCode===p.municipalityCode));
 for(const e of [...p.evidence,...p.amounts.map(x=>x.evidence),...p.indicators.map(x=>x.evidence),...p.ratings.map(x=>x.evidence)]){
  const s=sources.get(p.municipalityCode+'\n'+e.sourceUrl);assert.ok(s);assert.equal(e.sha256,s.acquisition.sourceSha256);assert.equal(e.fetchedAt,s.acquisition.fetchedAt);
  if(!checked.has(s.id)){const b=await readFile(join(base,s.text.assetPath));assert.equal(sha256(b),s.text.assetSha256);assert.equal(b.length,s.text.assetBytes);const d=JSON.parse(b.toString());assert.equal(d.municipalityCode,p.municipalityCode);assert.equal(d.sourceId,s.id);assert.equal(d.sourceUrl,s.url);assert.equal(d.sourceSha256,e.sha256);assert.equal(sha256(Buffer.from(d.text)),s.text.textSha256);const f=await fullText(base,s,d.text);const format=cachedSourceFormat(s,d);if(!f.complete){const scope=boundedSourceScope({municipalityCode:p.municipalityCode,municipalityName:p.municipalityName,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:e.sha256!,fetchedAt:e.fetchedAt!,format:format!,text:f.text,truncated:true});assert.ok(scope,'Incomplete input must have pinned complete-sheet approval');assert.equal(s.text.characters,scope.originalCharacters);assert.equal((s.text.continuations??[]).length,0);}checked.set(s.id,f.text);assert.ok(format,'Saved extraction provenance must establish a supported media format');formats.set(s.id,format);}
  if(s.text.truncated&&!(s.text.continuations??[]).length){const text=checked.get(s.id)!;const scope=boundedSourceScope({municipalityCode:p.municipalityCode,municipalityName:p.municipalityName,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:e.sha256!,fetchedAt:e.fetchedAt!,format:formats.get(s.id)! as 'pdf',text,truncated:true});assert.ok(scope);assertBoundedCandidate(p,text,scope);}
  assert.equal(e.format,formats.get(s.id));const t=checked.get(s.id)!,m=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);assert.ok(e.rawText);if(m)assert.equal(t.slice(+m[1],+m[2]),e.rawText);else assert.ok(t.includes(e.rawText));evidenceCount++;
 }
 }
 await mkdir(join(out,'inputs'),{recursive:true});
 for(const code of new Set(ps.map(p=>p.municipalityCode))){const projects=ps.filter(p=>p.municipalityCode===code),urls=[...new Set(projects.flatMap(p=>p.evidence.map(e=>e.sourceUrl)))];const input={schemaVersion:1,generatedAt:'2026-11-01T13:00:00.000Z',projects,sources:urls.map(url=>{const s=sources.get(code+'\n'+url),p=projects[0],count=projects.filter(p=>p.evidence.some(e=>e.sourceUrl===url)).length;return {id:'descending-'+code+'-'+s.id,municipalityCode:code,municipalityName:p.municipalityName,sourcePageUrl:url,evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:count,scope:'保存済み原典からの隔離候補。公開追加ではない。',message:'年度・引用・重複を照合。原PDF座標は未復元。',lastAttemptAt:s.acquisition.fetchedAt,lastSuccessAt:s.acquisition.fetchedAt,documents:[{url,format:formats.get(s.id)??s.format,status:'partial',sha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,projectCount:count,message:'保存済み本文ハッシュを照合'}]};})};parseEvaluationDataset(input);await writeFile(join(out,'inputs',code+'.json'),JSON.stringify(input)+'\n');}
 total+=ps.length;
}
console.log(JSON.stringify({validatedCandidateRecords:total,validatedEvidence:evidenceCount,productionRecordsAdded:0}));
