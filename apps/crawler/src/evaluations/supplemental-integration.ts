/** Append-only overlays. Original municipal assets and provenance are never rewritten. */
import { lstat, mkdir, readdir, realpath, rename, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, relative, sep, isAbsolute } from 'node:path';
import type { EvaluationDataset, ProjectEvaluation, EvaluationEvidence } from '../../../web/src/types/evaluation';
import { applyEnrichments, type EnrichmentInput } from './enrichment';
import { LIMITS, sha256, readBoundedFile, validateShardBytes, validateEvaluationIndex, verifyCoreIntegratedEvaluations,
  type IntegrationAssets, type EvaluationIndex, type MunicipalityIndexEntry } from './national-integration';
export const SUPPLEMENTAL_MANIFEST = 'data/evaluations/supplemental-provenance.json';
export const SUPPLEMENTAL_MANIFEST_MAX_BYTES = 16 * 1024 * 1024;
const json = (x:unknown) => Buffer.from(JSON.stringify(x)+'\n');
function check(x:unknown,message:string):asserts x {if(!x)throw new Error(message);}
const normalize = (s:string|null) => s?.normalize('NFKC').replace(/\s/g,'') ?? null;
const allEvidence=(p:ProjectEvaluation):EvaluationEvidence[]=>[...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)];
const documentKey=(url:string,hash:string|null)=>JSON.stringify([url,hash]);
function comparable(p:ProjectEvaluation):string {
  return JSON.stringify({name:normalize(p.projectName),department:normalize(p.department),evaluationYear:p.evaluationYear,evaluatedFiscalYear:p.evaluatedFiscalYear,
    purpose:p.purpose,activities:p.activities,outcomes:p.outcomes,amounts:p.amounts.map(({evidence:_e,...a})=>a),
    indicators:p.indicators.map(({evidence:_e,...i})=>i),ratings:p.ratings.map(({evidence:_e,...r})=>r)});
}
function samePeriod(a:ProjectEvaluation,b:ProjectEvaluation):boolean|null {
  if(a.evaluatedFiscalYear!==null && b.evaluatedFiscalYear!==null)return a.evaluatedFiscalYear===b.evaluatedFiscalYear;
  if(a.evaluationYear!==null && b.evaluationYear!==null)return a.evaluationYear===b.evaluationYear;
  return null;
}
export interface DistinctEvidence {
  sourceUrl:string;sha256:string;quote:string;
  cachedDocument?:{sourceId:string;textSha256:string};
}
export interface DistinctDecision {
  id:string;municipalityCode:string;existingId:string;incomingId:string;existingRecordSha256:string;incomingRecordSha256:string;reason:string;
  existingEvidence:DistinctEvidence;incomingEvidence:DistinctEvidence;
}
/** Opaque verification capability: callers cannot authorize a fabricated cache proof with a Set. */
export interface VerifiedSupplementalDecisionProofs {readonly kind:'verified-cached-decision-proofs'}
const verifiedProofContexts=new WeakMap<VerifiedSupplementalDecisionProofs,Set<string>>();
const proofKey=(code:string,proof:DistinctEvidence)=>JSON.stringify([code,proof.sourceUrl,proof.sha256,proof.quote,proof.cachedDocument?.sourceId,proof.cachedDocument?.textSha256]);
/** Validate the immutable index -> municipality shard -> text asset identity chain on every replay. */
export async function verifySupplementalDecisionProofs(root:string,decisions:DistinctDecision[]):Promise<VerifiedSupplementalDecisionProofs>{
  const context:VerifiedSupplementalDecisionProofs=Object.freeze({kind:'verified-cached-decision-proofs'});
  const verified=new Set<string>();
  const pending=decisions.flatMap(d=>[d.existingEvidence,d.incomingEvidence].filter(p=>p.cachedDocument).map(proof=>({code:d.municipalityCode,proof})));
  if(pending.length){
    const dir=join(root,'apps/web/public/evaluation-evidence');
    const index=JSON.parse((await readBoundedFile(join(dir,'index.json'),8*1024*1024)).toString());
    check(index.schemaVersion===1&&Array.isArray(index.municipalities),'Invalid cached evidence index');
    const municipalities=new Map<string,any>();const documents=new Map<string,any>();
    for(const {code,proof}of pending){
      const cache=proof.cachedDocument!;
      check(/^[0-9]{5}$/.test(code)&&/^[a-f0-9]{24}$/.test(cache.sourceId)&&/^[a-f0-9]{64}$/.test(cache.textSha256),'Invalid cached decision identity');
      check(typeof proof.quote==='string'&&proof.quote.trim().length>=8,'Cached decision quote is too short');
      if(!municipalities.has(code)){
        const rows=index.municipalities.filter((m:any)=>m.municipalityCode===code);check(rows.length===1,'Missing/duplicate cached municipality');const row=rows[0];
        check(row.shardPath===`municipalities/${code}.json`,'Unsafe cached municipality path');
        const bytes=await readBoundedFile(join(dir,row.shardPath),16*1024*1024);
        check(bytes.length===row.shardBytes&&sha256(bytes)===row.shardSha256,'Cached municipality hash mismatch');
        const shard=JSON.parse(bytes.toString());check(shard.municipality?.municipalityCode===code&&Array.isArray(shard.sources),'Cached municipality identity mismatch');municipalities.set(code,shard);
      }
      const matches=municipalities.get(code).sources.filter((s:any)=>s.id===cache.sourceId);check(matches.length===1,'Missing/duplicate cached decision source');const source=matches[0];
      check(source.url===proof.sourceUrl&&source.acquisition?.sourceSha256===proof.sha256,'Cached decision source identity mismatch');
      check(source.text?.assetPath===`documents/${cache.sourceId}.json`&&source.text.textSha256===cache.textSha256,'Cached decision text identity mismatch');
      if(!documents.has(cache.sourceId)){
        const bytes=await readBoundedFile(join(dir,source.text.assetPath),2*1024*1024);
        check(bytes.length===source.text.assetBytes&&sha256(bytes)===source.text.assetSha256,'Cached decision document hash mismatch');
        const doc=JSON.parse(bytes.toString());
        check(doc.municipalityCode===code&&doc.sourceId===cache.sourceId&&doc.sourceUrl===proof.sourceUrl&&doc.sourceSha256===proof.sha256,'Cached decision document identity mismatch');
        check(typeof doc.text==='string'&&sha256(Buffer.from(doc.text))===cache.textSha256&&doc.textSha256===cache.textSha256,'Cached decision content hash mismatch');documents.set(cache.sourceId,doc);
      }
      const doc=documents.get(cache.sourceId);
      check(doc.municipalityCode===code&&doc.sourceUrl===proof.sourceUrl&&doc.sourceSha256===proof.sha256&&doc.textSha256===cache.textSha256,'Cached decision reused content mismatch');
      check(doc.text.includes(proof.quote),'Cached decision quote is not an exact source substring');verified.add(proofKey(code,proof));
    }
  }
  verifiedProofContexts.set(context,verified);return context;
}
export interface AppendDecision {id:string;status:'added'|'replayed';existingId?:string;reason:string;distinctDecisionIds?:string[]}
export const supplementalRecordSha256=(p:ProjectEvaluation)=>sha256(json(p));
function validateDistinctDecision(d:DistinctDecision,old:ProjectEvaluation,p:ProjectEvaluation,context?:VerifiedSupplementalDecisionProofs){
  check(typeof d.id==='string' && d.id.trim().length>0 && typeof d.reason==='string' && d.reason.trim().length>=20,'Distinct decision needs an ID and substantive reason');
  check(d.municipalityCode===p.municipalityCode && d.existingRecordSha256===supplementalRecordSha256(old) && d.incomingRecordSha256===supplementalRecordSha256(p),'Distinct decision record identity mismatch');
  for(const [proof,record]of [[d.existingEvidence,old],[d.incomingEvidence,p]]as const){
    if(proof?.cachedDocument){
      check(context&&verifiedProofContexts.get(context)?.has(proofKey(d.municipalityCode,proof)),'Cached decision proof was not verified');
      check(allEvidence(record).some(e=>e.sourceUrl===proof.sourceUrl&&e.sha256===proof.sha256),'Cached decision proof is not bound to the record source');
    }else{
      check(proof && typeof proof.quote==='string' && proof.quote.trim().length>=16 && allEvidence(record).some(e=>e.sourceUrl===proof.sourceUrl && e.sha256===proof.sha256 && e.rawText.includes(proof.quote)),'Distinct decision quote is not supported by the bound record');
    }
  }
}
/** Fail closed on potential identity collisions. Improvements require a separate reviewed correction workflow. */
export function mergeSupplementalDataset(base:EvaluationDataset|null, incoming:EvaluationDataset, generatedAt:string, distinctDecisions:DistinctDecision[]=[],context?:VerifiedSupplementalDecisionProofs):{dataset:EvaluationDataset;decisions:AppendDecision[]} {
  const projects=[...(base?.projects??[])];const decisions:AppendDecision[]=[];const accepted:ProjectEvaluation[]=[];
  for(const p of incoming.projects) {
    const sameId=projects.find(x=>x.id===p.id);
    if(sameId){
      check(JSON.stringify(sameId)===JSON.stringify(p),`Correction/improvement is not append: ${p.id}`);
      const repeatedReviews=distinctDecisions.filter(d=>d.incomingId===p.id && d.municipalityCode===p.municipalityCode);
      for(const d of repeatedReviews){const old=projects.find(r=>r.id===d.existingId);check(old,'Distinct decision existing ID not found');validateDistinctDecision(d,old,p,context);}
      decisions.push({id:p.id,status:'replayed',existingId:p.id,reason:'identical ID and record',...(repeatedReviews.length?{distinctDecisionIds:repeatedReviews.map(d=>d.id)}:{})});continue;
    }
    let replay:ProjectEvaluation|undefined;const applied:string[]=[];
    for(const old of projects){
      const sameName=normalize(old.projectName)===normalize(p.projectName);
      const sameCode=old.projectCode!==null && p.projectCode!==null && normalize(old.projectCode)===normalize(p.projectCode);
      if(!sameName&&!sameCode)continue;
      const period=samePeriod(old,p);
      if(period===false)continue;
      const sameDepartment=!old.department||!p.department||normalize(old.department)===normalize(p.department);
      if(!sameCode && !sameDepartment)continue;
      const rawRepeat=p.evidence[0]?.rawText.length>100 && p.evidence[0].rawText===old.evidence[0]?.rawText;
      if(period===true && (sameCode || old.projectCode===null && p.projectCode===null) && comparable(old)===comparable(p) && rawRepeat){replay=old;break;}
      const reviewed=distinctDecisions.find(d=>d.existingId===old.id && d.incomingId===p.id && d.municipalityCode===p.municipalityCode);
      if(reviewed){validateDistinctDecision(reviewed,old,p,context);applied.push(reviewed.id);continue;}
      throw new Error(`Identity collision (${period===null?'unknown period':'same period'}): ${p.municipalityCode} ${p.projectName} incoming=${p.id} existing=${old.id}; review reprint vs distinct business vs correction`);
    }
    if(replay){decisions.push({id:p.id,status:'replayed',existingId:replay.id,reason:'same explicit period and semantic content; not an incremental project'});continue;}
    accepted.push(p);projects.push(p);decisions.push({id:p.id,status:'added',reason:applied.length?'reviewed distinct official business':'no identity collision',...(applied.length?{distinctDecisionIds:applied}:{})});
  }
  if(!accepted.length)return{dataset:base??incoming,decisions};
  const sources=structuredClone(base?.sources??[]);
  const locations=new Map<string,{source:number;document:number}>();
  for(let s=0;s<sources.length;s++)for(let d=0;d<sources[s].documents.length;d++){
    const doc=sources[s].documents[d],k=documentKey(doc.url,doc.sha256);
    // Existing datasets can share references; accepting new ownership would be ambiguous.
    if(locations.has(k))locations.set(k,{source:-1,document:-1});else locations.set(k,{source:s,document:d});
  }
  function ensureDocument(e:EvaluationEvidence){
    const key=documentKey(e.sourceUrl,e.sha256);const known=locations.get(key);
    if(known){check(known.source>=0,`Ambiguous document ownership: ${e.sourceUrl}`);return known;}
    const candidates=incoming.sources.flatMap(s=>s.documents.filter(d=>documentKey(d.url,d.sha256)===key).map(d=>({s,d})));
    check(candidates.length===1,`Missing/ambiguous evidence document: ${e.sourceUrl}`);
    const {s,d}=candidates[0];let idx=sources.findIndex(old=>old.id===s.id);
    if(idx<0){idx=sources.length;sources.push({...structuredClone(s),documents:[],discoveredDocuments:0,fetchedDocuments:0,extractedProjects:0});}
    else check(sources[idx].sourcePageUrl===s.sourcePageUrl && sources[idx].evaluationYear===s.evaluationYear,`Source ID collision: ${s.id}`);
    const target=sources[idx];target.documents.push({...structuredClone(d),projectCount:0});
    target.fetchedDocuments=target.documents.length;target.discoveredDocuments=Math.max(target.discoveredDocuments,target.fetchedDocuments);
    const location={source:idx,document:target.documents.length-1};locations.set(key,location);return location;
  }
  for(const p of accepted){
    check(p.evidence.length>0,`No primary evidence: ${p.id}`);
    for(const e of allEvidence(p))ensureDocument(e);
    const owner=ensureDocument(p.evidence[0]);sources[owner.source].documents[owner.document].projectCount++;sources[owner.source].extractedProjects++;
  }
  return{dataset:{schemaVersion:1,generatedAt,projects,sources},decisions};
}
export interface SupplementalInput {municipalityCode:string;sha256:string;bytes:number;path:string}
export interface SupplementalBatch {generatedAt:string;inputs:SupplementalInput[];distinctDecisions:DistinctDecision[];decisions:{municipalityCode:string;records:AppendDecision[]}[]}
export interface SupplementalManifest {schemaVersion:1;kind:'supplemental_evaluation_overlay';originalIndex:EvaluationIndex;originalIndexSha256:string;
  generatedAt:string;batches:SupplementalBatch[];outputIndexSha256:string;shards:MunicipalityIndexEntry[];
  /** Additive enrichments of published records, applied after every append batch (absent when none). */
  enrichmentBatches?:EnrichmentBatch[]}
export interface EnrichmentBatch {generatedAt:string;inputs:SupplementalInput[];applied:{municipalityCode:string;targets:number}[]}
export const ENRICHMENT_INPUTS='data/evaluations/enrichment-inputs';
function incomingRow(prior:MunicipalityIndexEntry, bytes:Buffer):MunicipalityIndexEntry {
  check(bytes.length>0 && bytes.length<=LIMITS.shardBytes,'Supplemental input byte bound exceeded');
  const d=JSON.parse(bytes.toString()) as EvaluationDataset;
  return{...prior,datasetPath:`evaluations-municipal/${prior.municipalityCode}.json`,datasetSha256:sha256(bytes),datasetBytes:bytes.length,primaryEvaluationRecords:d.projects.length};
}
export function composeSupplemental(base:IntegrationAssets,batches:{generatedAt:string;inputs:Map<string,Buffer>;distinctDecisions?:DistinctDecision[]}[],context?:VerifiedSupplementalDecisionProofs,enrichmentBatches:{generatedAt:string;inputs:Map<string,Buffer>}[]=[]):{assets:IntegrationAssets;manifest:SupplementalManifest;composed:Map<string,Buffer>} {
  check(!base.index.cohorts?.supplemental,'Overlay base must be immutable core integration');
  check(base.index.cohorts,'Cohort provenance required');
  const shards=new Map(base.shards);const rows=new Map(base.index.municipalities.map(r=>[r.municipalityCode,{...r}]));
  const changed=new Set<string>();const described:SupplementalBatch[]=[];let added=0;let generatedAt=base.index.generatedAt;
  for(const batch of batches){
    check(Number.isFinite(Date.parse(batch.generatedAt)),'Invalid append generatedAt');
    const distinctDecisions=batch.distinctDecisions??[];
    check(new Set(distinctDecisions.map(d=>d.id)).size===distinctDecisions.length && new Set(distinctDecisions.map(d=>JSON.stringify([d.municipalityCode,d.existingId,d.incomingId]))).size===distinctDecisions.length,'Duplicate distinct decisions');
    const decisions:SupplementalBatch['decisions']=[];const inputDescriptions:SupplementalInput[]=[];
    for(const [code,bytes] of [...batch.inputs].sort(([a],[b])=>a.localeCompare(b))){
      const prior=rows.get(code);check(prior,`Unknown municipality: ${code}`);
      const incoming=validateShardBytes(incomingRow(prior,bytes),bytes);
      check(incoming.projects.length>0,'Empty append input');
      const previous=shards.get(code);const merged=mergeSupplementalDataset(previous?JSON.parse(previous.toString()):null,incoming,batch.generatedAt,distinctDecisions,context);
      const n=merged.decisions.filter(d=>d.status==='added').length;
      decisions.push({municipalityCode:code,records:merged.decisions});
      const digest=sha256(bytes);inputDescriptions.push({municipalityCode:code,sha256:digest,bytes:bytes.length,path:`data/evaluations/supplemental-inputs/${digest}.json`});
      if(!n)continue;
      changed.add(code);added+=n;const content=json(merged.dataset);const row={...prior,discoveryStatus:'structured',dataStatus:'primary_available',
        primaryEvaluationRecords:merged.dataset.projects.length,datasetPath:`evaluations-composed/${code}-${sha256(content)}.json`,datasetSha256:sha256(content),datasetBytes:content.length,
        recordsWithSourceLabelledOutcomeIndicators:merged.dataset.projects.filter(p=>p.indicators.some(i=>i.name.includes('【成果指標】'))).length};
      validateShardBytes(row,content);rows.set(code,row);shards.set(code,content);
    }
    const used=new Set(decisions.flatMap(d=>d.records.flatMap(r=>r.distinctDecisionIds??[])));
    check(distinctDecisions.every(d=>used.has(d.id)), 'Unused or stale distinct decision');
    described.push({generatedAt:batch.generatedAt,inputs:inputDescriptions,distinctDecisions,decisions});generatedAt=batch.generatedAt;
  }
  const newMunicipalities=[...changed].filter(c=>!base.shards.has(c)).length;const appendChanged=changed.size;
  // Enrichments only add values to records that already exist; counts and cohorts stay those of the append batches.
  const enrichmentDescribed:EnrichmentBatch[]=[];
  for(const batch of enrichmentBatches){
    check(Number.isFinite(Date.parse(batch.generatedAt)),'Invalid enrichment generatedAt');
    const inputs:SupplementalInput[]=[];const applied:{municipalityCode:string;targets:number}[]=[];
    for(const [code,bytes] of [...batch.inputs].sort(([a],[b])=>a.localeCompare(b))){
      const input=JSON.parse(bytes.toString()) as EnrichmentInput;check(input.municipalityCode===code&&input.generatedAt===batch.generatedAt,'Enrichment input identity mismatch');
      const prior=rows.get(code);const shard=shards.get(code);check(prior&&shard&&prior.datasetPath,`Enrichment of a municipality without records: ${code}`);
      const dataset=applyEnrichments(JSON.parse(shard.toString()) as EvaluationDataset,input);
      const content=json(dataset);const row={...prior,datasetPath:`evaluations-composed/${code}-${sha256(content)}.json`,datasetSha256:sha256(content),datasetBytes:content.length,
        recordsWithSourceLabelledOutcomeIndicators:dataset.projects.filter(p=>p.indicators.some(i=>i.name.includes('【成果指標】'))).length};
      validateShardBytes(row,content);rows.set(code,row);shards.set(code,content);changed.add(code);
      const digest=sha256(bytes);inputs.push({municipalityCode:code,sha256:digest,bytes:bytes.length,path:`${ENRICHMENT_INPUTS}/${digest}.json`});applied.push({municipalityCode:code,targets:input.enrichments.length});
    }
    enrichmentDescribed.push({generatedAt:batch.generatedAt,inputs,applied});
  }
  const index:EvaluationIndex={...base.index,generatedAt,primaryEvaluationRecords:base.index.primaryEvaluationRecords+added,primaryMunicipalities:base.index.primaryMunicipalities+newMunicipalities,
    municipalities:base.index.municipalities.map(r=>rows.get(r.municipalityCode)!),cohorts:{...base.index.cohorts,supplemental:{primaryMunicipalities:newMunicipalities,primaryEvaluationRecords:added,existingMunicipalities:appendChanged-newMunicipalities}},
    notes:[...base.index.notes,'Supplemental append-only overlay: original municipal assets preserved; duplicate reprints excluded; corrections require separate review.']};
  validateEvaluationIndex(index);const ids=new Set<string>(),sourceIds=new Set<string>();
  for(const row of index.municipalities)if(row.datasetPath)validateShardBytes(row,shards.get(row.municipalityCode)!,undefined,ids,sourceIds);
  const indexBytes=json(index);const composed=new Map([...changed].sort().map(c=>[c,shards.get(c)!]));
  const manifest:SupplementalManifest={schemaVersion:1,kind:'supplemental_evaluation_overlay',originalIndex:base.index,originalIndexSha256:sha256(base.indexBytes),generatedAt,batches:described,outputIndexSha256:sha256(indexBytes),shards:[...changed].sort().map(c=>rows.get(c)!),...(enrichmentDescribed.length?{enrichmentBatches:enrichmentDescribed}:{})};
  const uniqueInputBytes=new Map(described.flatMap(b=>b.inputs.map(i=>[i.sha256,i.bytes] as const)));
  check([...uniqueInputBytes.values()].reduce((sum,n)=>sum+n,0)<=LIMITS.totalBytes,'Supplemental input aggregate byte bound exceeded');
  check(indexBytes.length<=LIMITS.indexBytes,'Supplemental index byte bound exceeded');
  check(json(manifest).length <= SUPPLEMENTAL_MANIFEST_MAX_BYTES, 'Supplemental manifest byte bound exceeded');
  return{assets:{...base,index,indexBytes,shards},manifest,composed};
}
export async function loadManifest(root:string):Promise<SupplementalManifest|null>{
  try {const m=JSON.parse((await readBoundedFile(join(root,SUPPLEMENTAL_MANIFEST),SUPPLEMENTAL_MANIFEST_MAX_BYTES)).toString()) as SupplementalManifest;
    check(m.schemaVersion===1 && m.kind==='supplemental_evaluation_overlay' && Array.isArray(m.batches),'Invalid supplemental provenance');
    check(sha256(json(validateEvaluationIndex(m.originalIndex)))===m.originalIndexSha256,'Supplemental original index hash mismatch');return m;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export async function loadBatches(root:string,m:SupplementalManifest){
  const batches=[];const cached=new Map<string,Buffer>();let totalBytes=0;
  for(const b of m.batches){const inputs=new Map<string,Buffer>();for(const x of b.inputs){
    check(/^[a-f0-9]{64}$/.test(x.sha256)&&x.path===`data/evaluations/supplemental-inputs/${x.sha256}.json`,'Unsafe supplemental input path');
    check(!inputs.has(x.municipalityCode),'Duplicate supplemental input municipality');
    if(!cached.has(x.sha256)){const content=await readBoundedFile(join(root,x.path),LIMITS.shardBytes);totalBytes+=content.length;check(totalBytes<=LIMITS.totalBytes,'Supplemental input aggregate byte bound exceeded');cached.set(x.sha256,content);}
    const bytes=cached.get(x.sha256)!;
    check(bytes.length===x.bytes && sha256(bytes)===x.sha256,'Supplemental input identity mismatch');inputs.set(x.municipalityCode,bytes);
  }batches.push({generatedAt:b.generatedAt,inputs,distinctDecisions:b.distinctDecisions});}return batches;
}
export async function loadEnrichmentBatches(root:string,m:SupplementalManifest){
  return Promise.all((m.enrichmentBatches??[]).map(async b=>{const inputs=new Map<string,Buffer>();
    for(const x of b.inputs){check(/^[a-f0-9]{64}$/.test(x.sha256)&&x.path===`${ENRICHMENT_INPUTS}/${x.sha256}.json`,'Unsafe enrichment input path');
      const bytes=await readBoundedFile(join(root,x.path),LIMITS.shardBytes);check(bytes.length===x.bytes&&sha256(bytes)===x.sha256,'Enrichment input identity mismatch');inputs.set(x.municipalityCode,bytes);}
    return{generatedAt:b.generatedAt,inputs};}));
}
export async function verifyImmutableEvaluationCore(root:string):Promise<IntegrationAssets>{
  const m=await loadManifest(root);return verifyCoreIntegratedEvaluations(root,m?json(m.originalIndex):undefined);
}
export async function verifySupplementalEvaluations(root:string,expectedIndexBytes?:Buffer):Promise<IntegrationAssets>{
  const m=await loadManifest(root);if(!m)return verifyCoreIntegratedEvaluations(root,expectedIndexBytes);
  const base=await verifyCoreIntegratedEvaluations(root,json(m.originalIndex));const batches=await loadBatches(root,m);
  const context=await verifySupplementalDecisionProofs(root,batches.flatMap(b=>b.distinctDecisions??[]));const rebuilt=composeSupplemental(base,batches,context,await loadEnrichmentBatches(root,m));
  check(json(rebuilt.manifest).equals(json(m)),'Supplemental provenance differs from validated composition');
  check(rebuilt.assets.indexBytes.equals(expectedIndexBytes??await readBoundedFile(join(root,'apps/web/public/evaluations-index.json'),LIMITS.indexBytes)),'Supplemental index mismatch');
  for(const row of m.shards)check(rebuilt.composed.get(row.municipalityCode)!.equals(await readBoundedFile(join(root,'apps/web/public',row.datasetPath!),LIMITS.shardBytes)),`Composed shard mismatch: ${row.municipalityCode}`);
  return rebuilt.assets;
}
export async function importSupplementalEvaluations(options:{root:string;sourceDirectory:string;generatedAt:string;distinctDecisions?:DistinctDecision[]}):Promise<IntegrationAssets>{
  const root=await realpath(options.root),source=await realpath(options.sourceDirectory);const pub=join(root,'apps/web/public');
  const rel=relative(pub,source);check(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'Input must be outside public assets');
  const current=await verifySupplementalEvaluations(root);const old=await loadManifest(root);
  const base=old?await verifyCoreIntegratedEvaluations(root,json(old.originalIndex)):current;
  const previous=old?await loadBatches(root,old):[];const inputs=new Map<string,Buffer>();
  const entries=(await readdir(source)).sort();check(entries.length>0&&entries.every(f=>/^[0-9]{5}\.json$/.test(f)),'Input directory must contain only municipality JSON files');
  for(const file of entries)inputs.set(file.slice(0,5),await readBoundedFile(join(source,file),LIMITS.shardBytes));
  const batches=[...previous,{generatedAt:options.generatedAt,inputs,distinctDecisions:options.distinctDecisions}];
  const context=await verifySupplementalDecisionProofs(root,batches.flatMap(b=>b.distinctDecisions??[]));
  const result=composeSupplemental(base,batches,context,old?await loadEnrichmentBatches(root,old):[]);
  if(result.manifest.batches.at(-1)!.decisions.every(d=>d.records.every(r=>r.status==='replayed')))return current;
  check((await readBoundedFile(join(pub,'evaluations-index.json'),LIMITS.indexBytes)).equals(current.indexBytes),'Index changed while preparing append');
  for(const path of [pub,join(root,'data/evaluations')]){const stat=await lstat(path);check(stat.isDirectory()&&!stat.isSymbolicLink(),'Output directory must not be a symlink');}
  await mkdir(join(root,'data/evaluations/supplemental-inputs'),{recursive:true});await mkdir(join(pub,'evaluations-composed'),{recursive:true});
  for(const path of [join(root,'data/evaluations/supplemental-inputs'),join(pub,'evaluations-composed')]){const stat=await lstat(path);check(stat.isDirectory()&&!stat.isSymbolicLink(),'Asset directory must not be a symlink');}
  const stage=await mkdtemp(join(root,'data/evaluations/.supplemental-'));
  async function immutable(path:string,bytes:Buffer){try{await writeFile(path,bytes,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;check((await readBoundedFile(path,Math.max(LIMITS.shardBytes,bytes.length))).equals(bytes),'Immutable asset conflict');}}
  try{
    for(const bytes of inputs.values())await immutable(join(root,`data/evaluations/supplemental-inputs/${sha256(bytes)}.json`),bytes);
    for(const [code,bytes]of result.composed){const row=result.assets.index.municipalities.find(r=>r.municipalityCode===code)!;await immutable(join(pub,row.datasetPath!),bytes);}
    await writeFile(join(stage,'manifest.json'),json(result.manifest));await writeFile(join(stage,'index.json'),result.assets.indexBytes);
    await rename(join(stage,'manifest.json'),join(root,SUPPLEMENTAL_MANIFEST));await rename(join(stage,'index.json'),join(pub,'evaluations-index.json'));
  }finally{await rm(stage,{recursive:true,force:true});}
  return verifySupplementalEvaluations(root);
}
