/** Offline family review: frozen baseline, verified whole texts, append-only import candidates. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import type {EvaluationDataset,ProjectEvaluation} from '../../web/src/types/evaluation';
import type {CachedInput} from './evaluations/expansion/shared';
import {sha256,type EvaluationIndex} from './evaluations/national-integration';
import {verifiedFullText} from './evaluations/expansion/fulltext';
import {mergeSupplementalDataset} from './evaluations/supplemental-integration';
import {familyReviewers} from './evaluations/expansion/families/registry';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const FAMILY_DATE='2026-10-26T01:55:00.000Z';
const allowed=new Set(['individual_layout_review','referenced_source_coverage_unproven','content_type_review']);
const evidenceOf=(p:ProjectEvaluation)=>[...p.evidence,...p.amounts.map(x=>x.evidence),...p.indicators.map(x=>x.evidence),...p.ratings.map(x=>x.evidence)];
export async function reviewCachedFamilies(output:string,inputsOnly=false){
 const pub=join(root,'apps/web/public'),b=join(pub,'evaluation-evidence');
 const frozen=gunzipSync(await readFile(join(root,'data/evaluations/cached-family-baseline-index.json.gz')));
 if(sha256(frozen)!=='d7d4deef3f49912a1b6bee402f3e88c4224295b91c5fb0e11f48c5349d5699af')throw new Error('Family baseline changed');
 const index:EvaluationIndex=JSON.parse(frozen.toString()),eiBytes=await readFile(join(b,'index.json'));
 if(sha256(eiBytes)!=='c421f91a42027736959b6d61c3fe2414631af794339b5d7412220d20d269a97f')throw new Error('Evidence inventory changed');
 const ei=JSON.parse(eiBytes.toString()),invBytes=await readFile(join(root,'data/evaluations/cached-inventory-review.json')),inv=JSON.parse(invBytes.toString());
 if(sha256(invBytes)!=='10e3acc2ebeedf1a86e7a5f1e0bc9bd161fbfe2f8d78f1f2acabe9ce9a705c4e')throw new Error('Prior inventory changed');
 const analysis=JSON.parse(await readFile(join(root,'data/evaluations/cached-family-review-inputs/source-review-ledger.json'),'utf8'));
 const queue=inv.rows.filter((r:any)=>allowed.has(r.disposition));const rows:any[]=[];const datasets=new Map<string,EvaluationDataset>();
 for(const mr of ei.municipalities){
  const mine=queue.filter((r:any)=>r.municipalityCode===mr.municipalityCode);if(!mine.length)continue;
  const code=mr.municipalityCode,reviewer=familyReviewers[code];
  if(!reviewer){for(const r of mine)rows.push({municipalityCode:code,sourceId:r.sourceId,sourceUrl:r.sourceUrl,sourceSha256:r.sourceSha256,fullTextSha256:r.fullTextSha256,priorDisposition:r.disposition,disposition:'family_review_pending',reason:'Cached input available; source family still needs layout/content review, not an access hold'});continue;}
  const mb=await readFile(join(b,mr.shardPath));if(mb.length!==mr.shardBytes||sha256(mb)!==mr.shardSha256)throw new Error('Family metadata integrity');
  const meta=JSON.parse(mb.toString()),br=index.municipalities.find(x=>x.municipalityCode===code)!;
  let old:EvaluationDataset={schemaVersion:1,generatedAt:FAMILY_DATE,sources:[],projects:[]};
  if(br.datasetPath){const bb=await readFile(join(pub,br.datasetPath));if(bb.length!==br.datasetBytes||sha256(bb)!==br.datasetSha256)throw new Error('Family old shard integrity');old=JSON.parse(bb.toString());}
  const prior=old.projects,inputs:CachedInput[]=[],sources=new Map<string,any>();
  for(const s of meta.sources){if(s.text.status!=='available'||s.verification.status!=='verified')continue;
   const bytes=await readFile(join(b,s.text.assetPath));if(s.text.assetPath!==`documents/${s.id}.json`||bytes.length!==s.text.assetBytes||sha256(bytes)!==s.text.assetSha256)throw new Error('Family first asset integrity');
   const doc=JSON.parse(bytes.toString()),full=await verifiedFullText(b,s,doc,code);
   const format=['pdf','html','xlsx'].includes(s.format)?s.format:doc.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':doc.extractionMethod==='visible_html_from_verified_bytes'?'html':null;
   if(!format||!s.acquisition.fetchedAt)continue;
   inputs.push({municipalityCode:code,municipalityName:br.municipalityName,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:doc.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format,text:full.text,truncated:!full.complete});sources.set(s.id,s);
  }
  const incoming:EvaluationDataset={schemaVersion:1,generatedAt:FAMILY_DATE,sources:[],projects:[]};
  for(const original of mine){
   const input=inputs.find(x=>x.sourceId===original.sourceId),s=sources.get(original.sourceId);
   const r:any={municipalityCode:code,sourceId:original.sourceId,sourceUrl:original.sourceUrl,sourceSha256:original.sourceSha256,priorDisposition:original.disposition,acceptedIds:[],holds:[]};rows.push(r);
   if(!input){r.disposition='input_identity_hold';r.reason='Verified readable input with supported extraction type/time not established';continue;}
   r.fullTextSha256=sha256(Buffer.from(input.text));r.parts=s.text.continuations??[];r.completeText=!input.truncated;
   const reviewed=reviewer(input,inputs,prior,s.title);
   if(!reviewed){r.disposition='family_review_pending';r.reason='Complete cached input; this layout is not yet covered by a verified family rule';continue;}
   Object.assign(r,{family:reviewed.family,units:reviewed.units,scope:reviewed.scope});
   for(const p of reviewed.projects){
    if(p.municipalityCode!==code||!p.evidence.length||p.evidence[0].sourceUrl!==input.sourceUrl||p.evidence[0].sha256!==input.sourceSha256)throw new Error('Family candidate source identity');
    if(p.evaluationYear===null&&p.evaluatedFiscalYear===null){r.holds.push({id:p.id,reason:'No explicit assessment or target year established'});continue;}
    for(const e of evidenceOf(p)){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl&&x.sourceSha256===e.sha256),pos=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);if(!src||!pos||!e.rawText||src.text.slice(+pos[1],+pos[2])!==e.rawText||e.fetchedAt!==src.fetchedAt)throw new Error('Family literal evidence/offset binding');}
    if(prior.some(x=>x.id===p.id)){r.holds.push({id:p.id,reason:'Existing ID retained without field changes'});continue;}
    const owners=[...new Map(inputs.filter(x=>evidenceOf(p).some(e=>e.sourceUrl===x.sourceUrl&&e.sha256===x.sourceSha256)).map(x=>[`${x.sourceUrl}:${x.sourceSha256}`,x])).values()].map(x=>{
     const n=x.sourceUrl===input.sourceUrl&&x.sourceSha256===input.sourceSha256?1:0;
     return{id:`family-${code}-${x.sourceId}`,municipalityCode:code,municipalityName:br.municipalityName,sourcePageUrl:x.sourcePageUrl,evaluationYear:null,status:'partial' as const,discoveredDocuments:1,fetchedDocuments:1,extractedProjects:n,scope:reviewed.scope,message:'保存済み全文から確認した個別事業のみ。未確定欄を推測しない。',lastAttemptAt:x.fetchedAt,lastSuccessAt:x.fetchedAt,documents:[{url:x.sourceUrl,format:x.format,status:'partial' as const,sha256:x.sourceSha256,fetchedAt:x.fetchedAt,projectCount:n,message:'原典ハッシュ・保存本文・引用位置を照合。追加取得なし。'}]};
    });
    const one:EvaluationDataset={schemaVersion:1,generatedAt:FAMILY_DATE,sources:owners,projects:[p]};
    try{const trial=mergeSupplementalDataset(old,one,FAMILY_DATE);if(trial.decisions[0].status!=='added'){r.holds.push({id:p.id,reason:'Existing identical record'});continue;}const merged=mergeSupplementalDataset(incoming,one,FAMILY_DATE);old=trial.dataset;Object.assign(incoming,merged.dataset);r.acceptedIds.push(p.id);}catch(error){r.holds.push({id:p.id,reason:(error as Error).message});}
   }
   r.disposition=r.acceptedIds.length?'individual_records_added':r.holds.length||reviewed.units.some(u=>/hold|review/.test(u.status))?'reviewed_with_holds':'reviewed_existing_or_nonrecord';
  }
  if(incoming.projects.length)datasets.set(code,incoming);
 }
 for(const row of rows){const a=analysis.find((x:any)=>x.sourceId===row.sourceId&&x.municipalityCode===row.municipalityCode);if(!a)throw new Error('Missing family source disposition');row.sourceReview=a;}
 const dispositions:Record<string,number>={};for(const r of rows)dispositions[r.disposition]=(dispositions[r.disposition]??0)+1;
 await mkdir(output,{recursive:inputsOnly});const dir=inputsOnly?output:join(output,'inputs');if(!inputsOnly)await mkdir(dir);
 for(const [code,d]of datasets)await writeFile(join(dir,`${code}.json`),JSON.stringify(d)+'\n');
 const audit={schemaVersion:1,phase:'cached-source-families',baseline:'411d9b12ca1037a9d45de65967075731734fb797',baselineIndexSha256:sha256(frozen),inventorySha256:sha256(invBytes),evidenceIndexSha256:sha256(eiBytes),generatedAt:FAMILY_DATE,sourceRequests:0,existingFieldsAdded:0,existingRecordsEnriched:0,queueSources:queue.length,reviewedSources:rows.filter(r=>r.family).length,dispositions,newRecords:[...datasets.values()].reduce((n,d)=>n+d.projects.length,0),additions:[...datasets].map(([code,d])=>({code,records:d.projects.length})),rows};
 await writeFile(join(output,inputsOnly?'../cached-family-audit.json':'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({...audit,rows:undefined}));return audit;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv[2]!=='--output-dir'||!process.argv[3])throw new Error('Use --output-dir <new directory>');await reviewCachedFamilies(resolve(process.argv[3]));}
