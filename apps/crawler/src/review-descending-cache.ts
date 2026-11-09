import{distinctUonumaHistoricalDepartments}from'./evaluations/expansion/descending-niigata-uonuma-history';
import {distinctShirakawaDepartmentRows} from './evaluations/expansion/descending-gifu-tail';
import {distinctUjitawaraSchoolRows} from './evaluations/expansion/descending-kyoto';
import {distinctSuitaDepartmentRows} from './evaluations/expansion/descending-osaka';
import {distinctOkayamaDepartmentRows} from './evaluations/expansion/descending-okayama';
import {distinctKagawaSchoolSheets} from './evaluations/expansion/descending-kagawa';
import {boundedSourceScope,reviewBoundedSource} from './evaluations/expansion/descending-bounded-review';
import {cachedSourceFormat} from './evaluations/expansion/cached-source-format';
/** Offline candidate audit. Never imports candidates into production or accesses source hosts. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './evaluations/national-integration';
import {fullText} from './evaluations/expansion/fulltext';
import {extractDescendingLayouts,reviewDescendingLayout} from './evaluations/expansion/descending-layouts-r2';
import {extractDescendingGrantRows} from './evaluations/expansion/descending-grant-rows';
import {extractDescendingKirishima} from './evaluations/expansion/descending-kirishima';
import {originalExtractors} from './descending-original-registry';
import {supplementExtractors} from './evaluations/expansion/supplement-registry';
import {laterExtractors} from './evaluations/expansion/later-registries';
import {setPriorRecords} from './evaluations/expansion/run-context';
import type {CachedInput} from './evaluations/expansion/shared';
import type {ProjectEvaluation} from '../../web/src/types/evaluation';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),pub=join(root,'apps/web/public'),base=join(pub,'evaluation-evidence');
const [cohortPath,outArg,priorRoot]=process.argv.slice(2);assert.ok(cohortPath&&outArg,'cohort.json output');
const out=resolve(outArg),rel=relative(pub,out);assert.ok(rel==='..'||rel.startsWith('..'+sep),'Output must be outside public assets');
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));const cohort=await read(cohortPath),index=await read(join(pub,'evaluations-index.json')),ei=await read(join(base,'index.json'));
const ledger:any[]=[],candidates:ProjectEvaluation[]=[],duplicates:any[]=[],held:any[]=[],prior=new Map<string,ProjectEvaluation[]>();
const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
for(const c of cohort.municipalities){const i=index.municipalities.find((x:any)=>x.municipalityCode===c.municipalityCode);assert.equal(i.datasetSha256,c.datasetSha256);let ps:ProjectEvaluation[]=[];if(i.datasetPath){const b=await readFile(join(pub,i.datasetPath));assert.equal(sha256(b),i.datasetSha256);ps=JSON.parse(b.toString()).projects;}if(priorRoot){try{const saved:ProjectEvaluation[]=await read(join(resolve(priorRoot),cohort.prefecture,'candidates.json'));ps.push(...saved.filter(p=>p.municipalityCode===c.municipalityCode));}catch(e:any){if(e.code!=='ENOENT')throw e;}}prior.set(c.municipalityCode,ps);}
setPriorRecords(code=>prior.get(code)??[]);
for(const c of cohort.municipalities){const mr=ei.municipalities.find((x:any)=>x.municipalityCode===c.municipalityCode);assert.equal(mr.shardSha256,c.evidenceShardSha256);const mb=await readFile(join(base,mr.shardPath));assert.equal(sha256(mb),mr.shardSha256);assert.equal(mb.length,mr.shardBytes);const meta=JSON.parse(mb.toString()),inputs:CachedInput[]=[],rows=new Map<string,any>();
 for(const s of meta.sources){const row:any={municipalityCode:c.municipalityCode,municipalityName:c.municipalityName,sourceId:s.id,url:s.url,title:s.title,status:'unsupported_layout',reason:'No supported individual-sheet parser output; source layout requires review, not an access denial',accepted:0,duplicates:0,held:0};ledger.push(row);rows.set(s.id,row);
 if(s.text.status!=='available'||!s.text.assetPath){row.status='missing_body';row.reason='No saved text asset; acquisition held pending original stop ledger';continue;}
 if(s.verification.status!=='verified'){row.status='insufficient_evidence';row.reason='Saved source verification is not verified';continue;}
 const b=await readFile(join(base,s.text.assetPath));assert.equal(sha256(b),s.text.assetSha256);assert.equal(b.length,s.text.assetBytes);const d=JSON.parse(b.toString());assert.equal(d.sourceId,s.id);assert.equal(d.sourceUrl,s.url);assert.equal(d.municipalityCode,c.municipalityCode);assert.equal(d.sourceSha256,s.acquisition.sourceSha256);assert.equal(sha256(Buffer.from(d.text)),s.text.textSha256);assert.equal(d.textSha256,s.text.textSha256);
 for(const part of s.text.continuations??[]){const p=await read(join(base,part.assetPath));assert.equal(p.municipalityCode,c.municipalityCode);assert.equal(p.part,part.part);assert.equal(p.textSha256,part.textSha256);assert.equal(p.fullTextSha256,s.text.fullTextSha256);}
 const f=await fullText(base,s,d.text);row.fullTextSha256=sha256(Buffer.from(f.text));row.complete=f.complete;row.sourceSha256=d.sourceSha256;row.fetchedAt=s.acquisition.fetchedAt;row.continuationParts=(s.text.continuations??[]).length;
 if(!f.complete){row.cachedPrefixSha256=row.fullTextSha256;delete row.fullTextSha256;}
 if(f.complete)assert.equal([...f.text].length,s.text.characters);
 const format=cachedSourceFormat(s,d);if(!format){row.status='format_evidence_hold';row.reason='Saved handler suffix is not a supported media type and saved extraction provenance does not establish the media format';continue;}
 const input:CachedInput={...c,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:d.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format,text:f.text,truncated:!f.complete};
 if(!f.complete){const scope=boundedSourceScope(input);if(!scope){row.status='insufficient_evidence';row.reason='Incomplete cached body without a verified complete-sheet boundary review; missing parts stay held';continue;}assert.equal(s.text.characters,scope.originalCharacters);assert.equal((s.text.continuations??[]).length,0);row.boundedPrefixOnly=true;}
 inputs.push(input);
 if(format==='html'){row.status='navigation';row.reason='Saved HTML; no supported individual-business output yet';}
 }
 const seen=[...(prior.get(c.municipalityCode)??[])];
 for(const input of inputs){const row=rows.get(input.sourceId),fns=input.truncated?[(i:CachedInput)=>reviewBoundedSource(i)?.projects??[]]:[extractDescendingLayouts,extractDescendingGrantRows,extractDescendingKirishima,originalExtractors[c.municipalityCode],supplementExtractors[c.municipalityCode]?.extract,...laterExtractors.map(r=>r.extractors[c.municipalityCode]?.extract)].filter(Boolean);row.parserFamilies=fns.length;
 for(const fn of fns){let ps:ProjectEvaluation[];try{ps=fn(input,inputs);}catch(e){const reason='Parser rejected source: '+String(e);(row.parserErrors??=[]).push({parser:fn.name,reason});row.held++;held.push({sourceId:input.sourceId,parser:fn.name,reason});continue;}
 for(const p of ps){const ev=[...p.evidence,...p.amounts.map(x=>x.evidence),...p.indicators.map(x=>x.evidence),...p.ratings.map(x=>x.evidence)];let reason='';
 if(p.municipalityCode!==c.municipalityCode)reason='Output attribution differs from cohort municipality';
 for(const e of ev){const src=inputs.find(i=>i.sourceUrl===e.sourceUrl&&i.sourceSha256===e.sha256),m=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);if(!src||!e.rawText||e.fetchedAt!==src.fetchedAt||(m?src.text.slice(+m[1],+m[2])!==e.rawText:!src.text.includes(e.rawText)))reason='Evidence does not exactly match hash-verified complete source';}
 const dup=seen.find(q=>q.id===p.id||!distinctUonumaHistoricalDepartments(q,p)&&!distinctShirakawaDepartmentRows(q,p)&&!distinctKagawaSchoolSheets(q,p)&&!distinctOkayamaDepartmentRows(q,p)&&!distinctSuitaDepartmentRows(q,p)&&!distinctUjitawaraSchoolRows(q,p)&&(norm(q.projectName)===norm(p.projectName)||(!!q.projectCode&&!!p.projectCode&&norm(q.projectCode)===norm(p.projectCode)))&&(q.evaluatedFiscalYear!==null&&p.evaluatedFiscalYear!==null?q.evaluatedFiscalYear===p.evaluatedFiscalYear:q.evaluationYear!==null&&p.evaluationYear!==null?q.evaluationYear===p.evaluationYear:true));
 if(dup){row.duplicates++;duplicates.push({sourceId:input.sourceId,candidateId:p.id,existingId:dup.id,municipalityCode:p.municipalityCode,projectName:p.projectName});continue;}
 if(p.evaluatedFiscalYear===null&&p.evaluationYear===null)reason='No explicit fiscal/evaluation year extracted';
 if(reason){row.held++;held.push({sourceId:input.sourceId,id:p.id,projectName:p.projectName,reason});continue;}
 // Preserve parser provenance; candidates are not publication-ready until independently reviewed.
 candidates.push(p);seen.push(p);row.accepted++;
 }}
 const layout=input.truncated?reviewBoundedSource(input):reviewDescendingLayout(input,inputs);if(layout){row.layoutReview={...layout,projects:undefined};}
 if(row.accepted)row.status='processed';else if(row.held)row.status='insufficient_evidence';else if(row.duplicates)row.status='duplicate';else if(layout){row.status=layout.status;row.reason=layout.reason;}
 if(['processed','duplicate'].includes(row.status))row.reason='Supported parser outputs screened against current master; source coverage is not asserted complete';
 }
}
setPriorRecords(null);await mkdir(out,{recursive:true});
const summary={cohort:cohort.prefecture,municipalities:cohort.municipalities.length,sources:ledger.length,hashVerifiedBodies:ledger.filter(r=>r.fullTextSha256||r.cachedPrefixSha256).length,continuationParts:ledger.reduce((n,r)=>n+(r.continuationParts??0),0),candidateRecords:candidates.length,candidateMunicipalities:new Set(candidates.map(p=>p.municipalityCode)).size,duplicateOutputs:duplicates.length,heldOutputs:held.length,productionRecordsAdded:0,existingFieldsChanged:0,municipalRequests:0,layoutReviewedUnits:ledger.reduce((n,r)=>n+(r.layoutReview?.units.length??0),0),layoutActionableUnits:ledger.flatMap(r=>r.layoutReview?.units??[]).filter(u=>u.status==='layout_review').length,layoutHeldUnits:ledger.flatMap(r=>r.layoutReview?.units??[]).filter(u=>u.status==='held'||u.status.endsWith('_hold')).length,statuses:ledger.reduce((a:any,r)=>(a[r.status]=(a[r.status]??0)+1,a),{})};
for(const [name,x]of Object.entries({'source-ledger':ledger,candidates,duplicates,held,summary}))await writeFile(join(out,name+'.json'),JSON.stringify(x)+'\n');
console.log(JSON.stringify(summary));
