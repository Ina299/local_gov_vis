/** Exhaustive offline metadata/part inventory. No network imports or requests. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import type {EvaluationDataset,ProjectEvaluation} from '../../web/src/types/evaluation';
import {sha256,type EvaluationIndex} from './evaluations/national-integration';
import {mergeSupplementalDataset} from './evaluations/supplemental-integration';
import {verifiedFullText} from './evaluations/expansion/fulltext';
import {supplementExtractors} from './evaluations/expansion/supplement-registry';
import {laterExtractors} from './evaluations/expansion/later-registries';
import {reviewMogamiSheets,reviewTaitoSheet,reviewOgawaIdentity} from './evaluations/expansion/inventory-sheets';
import {setPriorRecords} from './evaluations/expansion/run-context';
import type {CachedInput} from './evaluations/expansion/shared';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const REPLAY_CODES=new Set(['01230','04215','06362','08204','11208','11221','12232','13102','13109','13114','14100','34369','42212']);
export const INVENTORY_DATE='2026-10-26T01:12:00.000Z';
const evidenceOf=(p:ProjectEvaluation)=>[...p.evidence,...p.amounts.map(x=>x.evidence),...p.indicators.map(x=>x.evidence),...p.ratings.map(x=>x.evidence)];
const closedFiles=['cached-document-review-batch6.json','enrichment-document-review-batch1.json','offline-source-review-batch12.json','continuation-review.json'];
const norm=(s:string|null)=>(s??'').normalize('NFKC').replace(/\s/g,'');
export async function reviewCachedInventory(output:string,inputsOnly=false){
 const b=join(root,'apps/web/public/evaluation-evidence'),pub=join(root,'apps/web/public');
 const frozen=gunzipSync(await readFile(join(root,'data/evaluations/cached-inventory-baseline-index.json.gz')));
 if(sha256(frozen)!=='e5c5395bfb48c35e92ece631f913850345a1ce50318b741426c51d2855e2b006')throw new Error('Frozen inventory baseline mismatch');
 const index:EvaluationIndex=JSON.parse(frozen.toString()),eiBytes=await readFile(join(b,'index.json')),ei=JSON.parse(eiBytes.toString());
 if(sha256(eiBytes)!=='c421f91a42027736959b6d61c3fe2414631af794339b5d7412220d20d269a97f')throw new Error('Evidence inventory changed; create a separately reviewed phase');
 const closed=new Map<string,string[]>(),closedInputs=[];
 for(const file of closedFiles){const bytes=await readFile(join(root,'data/evaluations',file)),d=JSON.parse(bytes.toString());closedInputs.push({path:`data/evaluations/${file}`,sha256:sha256(bytes)});
  for(const row of d.rows??d.reviews){const id=row.documentId??row.sourceId;if(id)closed.set(id,[...(closed.get(id)??[]),file]);}}
 const metadata=[];const closedHashes=new Map<string,string[]>();
 for(const row of ei.municipalities){const bytes=await readFile(join(b,row.shardPath));if(bytes.length!==row.shardBytes||sha256(bytes)!==row.shardSha256)throw new Error(`Metadata integrity: ${row.municipalityCode}`);
  const m=JSON.parse(bytes.toString());metadata.push({row,m});for(const s of m.sources)if(closed.has(s.id)&&s.acquisition.sourceSha256)closedHashes.set(`${row.municipalityCode}:${s.acquisition.sourceSha256}`,closed.get(s.id)!);}
 const rows:any[]=[],datasets=new Map<string,EvaluationDataset>();let partsListed=0,partsVerified=0;
 for(const {row,m} of metadata){
  if(inputsOnly&&!REPLAY_CODES.has(row.municipalityCode))continue;
  const code=row.municipalityCode,br=index.municipalities.find(x=>x.municipalityCode===code)!;
  let old:EvaluationDataset={schemaVersion:1,generatedAt:INVENTORY_DATE,sources:[],projects:[]};
  if(br.datasetPath){const bytes=await readFile(join(pub,br.datasetPath));if(bytes.length!==br.datasetBytes||sha256(bytes)!==br.datasetSha256)throw new Error('Baseline shard mismatch');old=JSON.parse(bytes.toString());}
  const before=old.projects;setPriorRecords(c=>{if(c!==code)throw new Error('Wrong prior context');return before;});
  const refCounts=new Map<string,number>();for(const p of before)for(const h of new Set(evidenceOf(p).map(e=>e.sha256)))refCounts.set(h,(refCounts.get(h)??0)+1);
  const inputs:CachedInput[]=[],records=new Map<string,any>();
  for(const s of m.sources){
   const r:any={municipalityCode:code,sourceId:s.id,sourceUrl:s.url,title:s.title,format:s.format,evaluationType:s.evaluationType,verification:s.verification.status,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,textStatus:s.text.status,declaredCharacters:s.text.characters,primaryTruncated:s.text.truncated,parts:s.text.continuations??[],referencedRecords:refCounts.get(s.acquisition.sourceSha256)??0,closedCohorts:closed.get(s.id)??closedHashes.get(`${code}:${s.acquisition.sourceSha256}`)??[],coverage:'not_established',acceptedIds:[],holds:[]};rows.push(r);records.set(s.id,r);partsListed+=r.parts.length;
   if(s.text.status!=='available') {r.disposition='absent_readable_input';r.reason=s.acquisition.state==='acquired'?'Original content recorded as acquired, but no readable text asset; not an access denial':'No acquired readable text; not an access denial';continue;}
   try{
    if(s.text.assetPath!==`documents/${s.id}.json`)throw new Error('Unexpected first asset path');
    const bytes=await readFile(join(b,s.text.assetPath));if(bytes.length!==s.text.assetBytes||sha256(bytes)!==s.text.assetSha256)throw new Error('First asset bytes/hash mismatch');
    const doc=JSON.parse(bytes.toString());const whole=await verifiedFullText(b,s,doc,code);partsVerified+=r.parts.length;
    r.fullTextSha256=sha256(Buffer.from(whole.text));r.verifiedCharacters=[...whole.text].length;r.completeText=whole.complete;r.integrity='verified';
    if(!s.acquisition.fetchedAt || !['pdf','html','xlsx'].includes(s.format)){r.disposition='unsupported_input';r.reason='Missing acquisition time or unsupported format';continue;}
    inputs.push({municipalityCode:code,municipalityName:br.municipalityName,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:doc.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:s.format,text:whole.text,truncated:!whole.complete});
   }catch(error){r.disposition='input_integrity_hold';r.reason=(error as Error).message;r.integrity='failed';}
  }
  const incoming:EvaluationDataset={schemaVersion:1,generatedAt:INVENTORY_DATE,sources:[],projects:[]};
  const extractors=[supplementExtractors[code],...laterExtractors.map(x=>x.extractors[code])].filter((x):x is NonNullable<typeof x>=>!!x);
  for(const input of inputs){const r=records.get(input.sourceId)!;
   if(r.closedCohorts.length){r.disposition='completed_cohort_preserved';r.coverage='prior_review_scope_only_not_entire_document_claim';continue;}
   if(r.verification!=='verified'){r.disposition='source_identity_hold';r.reason='Official source identity not established';continue;}
   if(input.truncated){r.disposition='partial_cached_input';r.reason='All listed parts checked, but metadata does not establish complete cached full text';continue;}
   const candidates=new Map<string,ProjectEvaluation>(),conflicts=new Set<string>();
   const reviewed=[reviewMogamiSheets(input,before),reviewTaitoSheet(input,r.title,before),reviewOgawaIdentity(input,before)];
   r.individualUnits=reviewed.flatMap(x=>x.units);for(const p of reviewed.flatMap(x=>x.projects))candidates.set(p.id,p);
   for(const ext of extractors){try{for(const p of ext.extract(input,inputs)){if(candidates.has(p.id)&&JSON.stringify(candidates.get(p.id))!==JSON.stringify(p))conflicts.add(p.id);else candidates.set(p.id,p);}}catch(error){r.holds.push({unit:'extractor',reason:(error as Error).message.slice(0,240)});}}
   r.candidateRecords=candidates.size;r.existingCandidateIds=[];
   for(const p of candidates.values()){
    if(conflicts.has(p.id)){r.holds.push({unit:p.id,reason:'Extractor conflict; no overwrite'});continue;}
    if(before.some(q=>q.id===p.id)){r.existingCandidateIds.push(p.id);continue;}
    if(p.evaluatedFiscalYear===null){r.holds.push({unit:p.id,reason:'Explicit evaluated fiscal year required for this phase; no inference from evaluation year'});continue;}
    if(p.municipalityCode!==code||!p.evidence.length||p.evidence[0].sourceUrl!==input.sourceUrl||p.evidence[0].sha256!==input.sourceSha256){r.holds.push({unit:p.id,reason:'Invalid identity/evidence'});continue;}
    let exact=true;
    for(const e of evidenceOf(p)){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl&&x.sourceSha256===e.sha256),pos=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);if(!src||!pos||!e.rawText||src.text.slice(+pos[1],+pos[2])!==e.rawText||e.fetchedAt!==src.fetchedAt)exact=false;}
    if(!exact){r.holds.push({unit:p.id,reason:'Literal quote/source/offset binding failed'});continue;}
    const alias=old.projects.find(q=>p.evaluatedFiscalYear!==null&&q.evaluatedFiscalYear===p.evaluatedFiscalYear&&p.purpose&&p.activities&&norm(q.purpose)===norm(p.purpose)&&norm(q.activities)===norm(p.activities)&&(norm(q.projectName).includes(norm(p.projectName))||norm(p.projectName).includes(norm(q.projectName))));
    if(alias){r.holds.push({unit:p.id,reason:`Possible same-period alias: ${alias.id}`});continue;}
    if(code==='11208'&&p.indicators.length){r.holds.push({unit:p.id,reason:'Policy-level indicators omitted from individual business record',fieldOnly:true});p.indicators=[];}
    p.warnings.push('本追加では掲載された全継続パートと全文ハッシュを検証済み。従前の抽出器による「先頭12万字」等の記述は旧入力の制約であり、今回の入力は検証済み全文。個票の全数値の抽出完了を意味しない。');
    const ownerInputs=[...new Map(inputs.filter(x=>evidenceOf(p).some(e=>e.sourceUrl===x.sourceUrl&&e.sha256===x.sourceSha256)).map(x=>[`${x.sourceUrl}:${x.sourceSha256}`,x])).values()];
    const owners=ownerInputs.map(x=>({id:`inventory-${code}-${x.sourceId}`,municipalityCode:code,municipalityName:br.municipalityName,sourcePageUrl:x.sourcePageUrl,evaluationYear:null,status:'partial' as const,discoveredDocuments:1,fetchedDocuments:1,extractedProjects:x.sourceUrl===input.sourceUrl&&x.sourceSha256===input.sourceSha256?1:0,scope:'保存本文の明示された個別事業のみ。全冊子の網羅性・全数値の抽出完了を意味しない。',message:'原典取得なし。年度・金額種別を推測しない。',lastAttemptAt:x.fetchedAt,lastSuccessAt:x.fetchedAt,documents:[{url:x.sourceUrl,format:x.format,status:'partial' as const,sha256:x.sourceSha256,fetchedAt:x.fetchedAt,projectCount:x.sourceUrl===input.sourceUrl&&x.sourceSha256===input.sourceSha256?1:0,message:'保存本文と原文引用の完全一致を照合'}]}));
    const single:EvaluationDataset={schemaVersion:1,generatedAt:INVENTORY_DATE,sources:owners,projects:[p]};
    try{const trial=mergeSupplementalDataset(old,single,INVENTORY_DATE);if(trial.decisions[0].status!=='added'){r.holds.push({unit:p.id,reason:'Existing identical record'});continue;}const merged=mergeSupplementalDataset(incoming,single,INVENTORY_DATE);old=trial.dataset;Object.assign(incoming,merged.dataset);r.acceptedIds.push(p.id);}catch(error){const reason=(error as Error).message;r.holds.push({unit:p.id,reason});}
   }
   if(r.acceptedIds.length)r.disposition='reliable_individual_records_extracted';
   else if(r.holds.length)r.disposition='duplicates_identity_or_layout_hold';
   else if(r.existingCandidateIds.length) {r.disposition='existing_extractor_scope_covered';r.coverage='all_candidates_of_registered_extractor_present_not_whole_document_claim';}
   else if(r.individualUnits.length){r.disposition=r.individualUnits.some((u:any)=>u.disposition==='layout_identity_hold')?'individual_layout_review':'individual_units_reviewed';r.coverage='listed_individual_units_accounted_for_only_no_whole_document_or_field_coverage_claim';}
   else if(input.format==='html')r.disposition='html_context_review';
   else if(r.referencedRecords)r.disposition='referenced_source_coverage_unproven';
   else if(/事務事業評価(?:シート|調書|票)|事業評価(?:シート|調書)|事業の目的|事業目的/.test(input.text))r.disposition='individual_layout_review';
   else r.disposition='content_type_review';
  }
  if(incoming.projects.length)datasets.set(code,incoming);
 }
 setPriorRecords(null);
 const groups=new Map<string,any[]>();for(const r of rows)if(r.integrity==='verified'){const k=`${r.municipalityCode}:${r.sourceSha256}:${r.fullTextSha256}`;groups.set(k,[...(groups.get(k)??[]),r]);}
 for(const group of groups.values())if(group.length>1)for(const r of group){
  r.identicalCachedSourceIds=group.filter(q=>q!==r).map(q=>q.sourceId);
  const owner=group.find(q=>q!==r&&q.individualUnits?.length&&q.individualUnits.every((u:any)=>u.disposition!=='layout_identity_hold'));
  if(owner&&!r.acceptedIds.length&&!r.closedCohorts.length){r.disposition='identical_cached_source_reviewed';r.coverage=`Same original/fulltext hashes as ${owner.sourceId}; individual-unit review applies, not full field extraction`;}
 }
 const counts:Record<string,number>={};for(const r of rows)counts[r.disposition]=(counts[r.disposition]??0)+1;
 await mkdir(output,{recursive:inputsOnly});const inputDir=inputsOnly?output:join(output,'inputs');if(!inputsOnly)await mkdir(inputDir);
 for(const [code,d] of datasets)await writeFile(join(inputDir,`${code}.json`),JSON.stringify(d)+'\n');
 const audit={schemaVersion:1,phase:'systematic-cached-inventory',baseline:'29f2aed385a4f9909464ba83c5d896dcdd2ed456',baselineIndexSha256:sha256(frozen),evidenceIndexSha256:sha256(eiBytes),generatedAt:INVENTORY_DATE,sourceRequests:0,existingFieldsAdded:0,existingRecordsEnriched:0,municipalities:metadata.length,sourceRows:rows.length,partsListed,partsVerified,closedInputs,dispositions:counts,newRecords:[...datasets.values()].reduce((n,d)=>n+d.projects.length,0),additions:[...datasets].map(([code,d])=>({code,records:d.projects.length})),scope:'All current metadata rows and every listed continuation checked. Inventory dispositions are not claims that all layouts have been manually extracted. Closed cohorts remain closed.',rows};
 await writeFile(join(output,inputsOnly?'../cached-inventory-audit.json':'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({...audit,rows:undefined,closedInputs:undefined}));return audit;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv[2]!=='--output-dir'||!process.argv[3])throw new Error('Use --output-dir <new directory>');await reviewCachedInventory(resolve(process.argv[3]));}
