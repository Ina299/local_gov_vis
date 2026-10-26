/** Evidence-bound field enrichment. Immutable core/supplement records remain replayable. */
import {writeFile,mkdir,rename,rm,mkdtemp,lstat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import type {EvaluationDataset,ProjectEvaluation,EvaluationEvidence,EvaluationAmount,EvaluationIndicator,EvaluationRating} from '../../../web/src/types/evaluation';
import {sha256,readBoundedFile,LIMITS,validateEvaluationIndex,validateShardBytes,type IntegrationAssets,type EvaluationIndex,type MunicipalityIndexEntry} from './national-integration';
import {verifySupplementalEvaluations,verifySupplementalDecisionProofs,supplementalRecordSha256,type DistinctDecision} from './supplemental-integration';
export const ENRICHMENT_MANIFEST='data/evaluations/enrichment-provenance.json';
const MAX_MANIFEST=16*1024*1024;
const json=(v:unknown)=>Buffer.from(JSON.stringify(v)+'\n');
function check(v:unknown,message:string):asserts v{if(!v)throw new Error(message);}
export interface EnrichmentProof{sourceId:string;sourceUrl:string;sourceSha256:string;textSha256:string;quote:string;cell:string}
export interface EnrichedValue<T>{value:T;proofs:EnrichmentProof[]}
export interface EnrichmentPatch{
 id:string;municipalityCode:string;projectId:string;beforeRecordSha256:string;
 identity:{reason:string;proofs:EnrichmentProof[]};
 set?:{purpose?:EnrichedValue<string>;activities?:EnrichedValue<string>;outcomes?:EnrichedValue<string>;evaluationYear?:EnrichedValue<number>;evaluatedFiscalYear?:EnrichedValue<number>};
 append?:{amounts?:EnrichedValue<EvaluationAmount>[];indicators?:EnrichedValue<EvaluationIndicator>[];ratings?:EnrichedValue<EvaluationRating>[];evidence?:EnrichedValue<EvaluationEvidence>[]};
}
export interface EnrichmentInput{schemaVersion:1;generatedAt:string;patches:EnrichmentPatch[]}
interface InputAsset{path:string;sha256:string;bytes:number}
export interface EnrichmentManifest{schemaVersion:1;kind:'evaluation_field_enrichment';baseIndex:EvaluationIndex;baseIndexSha256:string;generatedAt:string;inputs:InputAsset[];outputIndexSha256:string;shards:MunicipalityIndexEntry[];statistics:{patches:number;changedRecords:number;filledFields:number;addedArrayItems:number;duplicateValues:number;filledFieldsByField:Record<string,number>;addedArrayItemsByField:Record<string,number>}}
const key=(code:string,p:EnrichmentProof)=>JSON.stringify([code,p.sourceId,p.sourceUrl,p.sourceSha256,p.textSha256,p.quote,p.cell]);
const fields=['purpose','activities','outcomes','evaluationYear','evaluatedFiscalYear'] as const;
const arrays=['amounts','indicators','ratings','evidence']as const;
const recordEvidence=(p:ProjectEvaluation)=>[...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)];
function patchProofs(p:EnrichmentPatch):EnrichmentProof[]{return [...p.identity.proofs,...Object.values(p.set??{}).flatMap(v=>v.proofs),...Object.values(p.append??{}).flatMap(v=>v.flatMap(x=>x.proofs))];}
function parseInput(bytes:Buffer):EnrichmentInput{
 check(bytes.length>0&&bytes.length<=LIMITS.totalBytes,'Enrichment input byte limit');const v=JSON.parse(bytes.toString());
 check(v.schemaVersion===1&&Number.isFinite(Date.parse(v.generatedAt))&&Array.isArray(v.patches)&&v.patches.length>0,'Invalid enrichment input');
 for(const p of v.patches){
  check(p&&typeof p.id==='string'&&p.id.length&&/^[0-9]{5}$/.test(p.municipalityCode)&&typeof p.projectId==='string'&&/^[a-f0-9]{64}$/.test(p.beforeRecordSha256),'Invalid patch identity');
  check(p.identity&&typeof p.identity.reason==='string'&&p.identity.reason.trim().length>=20&&Array.isArray(p.identity.proofs)&&p.identity.proofs.length,'Enrichment requires same-business evidence');
  check(Object.keys(p).every(k=>['id','municipalityCode','projectId','beforeRecordSha256','identity','set','append'].includes(k)),'Unsupported enrichment patch property');
  check(Object.keys(p.set??{}).every(k=>(fields as readonly string[]).includes(k))&&Object.keys(p.append??{}).every(k=>(arrays as readonly string[]).includes(k)),'Unsupported enrichment field');
  for(const v of Object.values(p.set??{}))check(v&&Array.isArray((v as EnrichedValue<unknown>).proofs)&&(v as EnrichedValue<unknown>).proofs.length,'Field requires proofs');
  for(const list of Object.values(p.append??{})){check(Array.isArray(list),'Invalid append list');for(const v of list)check(v&&Array.isArray(v.proofs)&&v.proofs.length,'Append requires proofs');}
  for(const proof of patchProofs(p))check(proof&&typeof proof.quote==='string'&&proof.quote.trim().length>=8&&/^extracted-text:chars:\d+-\d+$/.test(proof.cell),'Invalid enrichment proof');
 }
 return v;
}
/** Verify hash-chain and exact offsets in one batch; no caller-provided trust flags. */
async function verifyProofs(root:string,patches:EnrichmentPatch[]):Promise<Map<string,EvaluationEvidence>>{
 const unique=new Map<string,{code:string;p:EnrichmentProof}>();for(const patch of patches)for(const p of patchProofs(patch))unique.set(key(patch.municipalityCode,p),{code:patch.municipalityCode,p});
 const decisions:DistinctDecision[]=[...unique.values()].map(({code,p},i)=>{const proof={sourceUrl:p.sourceUrl,sha256:p.sourceSha256,quote:p.quote,cachedDocument:{sourceId:p.sourceId,textSha256:p.textSha256}};return{id:String(i),municipalityCode:code,existingId:'',incomingId:'',existingRecordSha256:'',incomingRecordSha256:'',reason:'',existingEvidence:proof,incomingEvidence:proof};});
 await verifySupplementalDecisionProofs(root,decisions);
 const docs=new Map<string,any>(),municipalities=new Map<string,any>(),verified=new Map<string,EvaluationEvidence>();
 for(const[k,{code,p}]of unique){
  if(!docs.has(p.sourceId))docs.set(p.sourceId,JSON.parse((await readBoundedFile(join(root,'apps/web/public/evaluation-evidence/documents',p.sourceId+'.json'),2*1024*1024)).toString()));
  const doc=docs.get(p.sourceId),m=/^extracted-text:chars:(\d+)-(\d+)$/.exec(p.cell)!;const a=Number(m[1]),b=Number(m[2]);
  check(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=0&&b>a&&doc.text.slice(a,b)===p.quote,'Enrichment proof position mismatch');
  if(!municipalities.has(code))municipalities.set(code,JSON.parse((await readBoundedFile(join(root,'apps/web/public/evaluation-evidence/municipalities',code+'.json'),16*1024*1024)).toString()));
  const src=municipalities.get(code).sources.find((s:any)=>s.id===p.sourceId);check(src&&src.acquisition.fetchedAt,'Missing proof acquisition');
  verified.set(k,{sourceUrl:p.sourceUrl,sourcePageUrl:p.sourceUrl,format:src.format,fetchedAt:src.acquisition.fetchedAt,sha256:p.sourceSha256,rawText:p.quote,page:null,sheet:null,cell:p.cell});
 }
 return verified;
}
export async function readCachedProof(root:string,code:string,sourceId:string,quote:string,start?:number):Promise<EnrichmentProof>{
 check(/^[a-f0-9]{24}$/.test(sourceId),'Invalid cached source ID');const d=JSON.parse((await readBoundedFile(join(root,'apps/web/public/evaluation-evidence/documents',sourceId+'.json'),2*1024*1024)).toString());
 const a=start??d.text.indexOf(quote);check(a>=0&&d.text.slice(a,a+quote.length)===quote,'Quote absent');
 const p={sourceId,sourceUrl:d.sourceUrl,sourceSha256:d.sourceSha256,textSha256:d.textSha256,quote,cell:`extracted-text:chars:${a}-${a+quote.length}`};await evidenceFromProof(root,code,p);return p;
}
export async function evidenceFromProof(root:string,code:string,proof:EnrichmentProof):Promise<EvaluationEvidence>{
 const map=await verifyProofs(root,[{id:'helper',municipalityCode:code,projectId:'',beforeRecordSha256:'',identity:{reason:'helper',proofs:[proof]}}]);return map.get(key(code,proof))!;
}
async function manifest(root:string):Promise<EnrichmentManifest|null>{try{const m=JSON.parse((await readBoundedFile(join(root,ENRICHMENT_MANIFEST),MAX_MANIFEST)).toString());check(m.schemaVersion===1&&m.kind==='evaluation_field_enrichment'&&Array.isArray(m.inputs),'Invalid enrichment manifest');validateEvaluationIndex(m.baseIndex);check(sha256(json(m.baseIndex))===m.baseIndexSha256,'Enrichment base index hash mismatch');return m;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
export async function readEnrichmentBase(root:string):Promise<IntegrationAssets>{const m=await manifest(root);return verifySupplementalEvaluations(root,m?json(m.baseIndex):undefined);}
const withoutEvidence=(v:unknown)=>{if(v&&typeof v==='object'&&!Array.isArray(v)){const{evidence:_e,...rest}=v as Record<string,unknown>;return JSON.stringify(rest);}return JSON.stringify(v);};
export function assertExplicitYear(year:unknown,proofs:EnrichmentProof[]){
 check(Number.isInteger(year)&&Number(year)>=1900&&Number(year)<=2200,'Invalid explicit year');const n=Number(year);
 check(proofs.some(p=>{const original=p.quote.normalize('NFKC'),t=original.replace(/\s/g,'');return new RegExp(`(?<![0-9])${n}(?![0-9])`).test(original)||[['令和',2018],['平成',1988],['昭和',1925]].some(([era,offset])=>n>Number(offset)&&t.includes(`${era}${n===Number(offset)+1?'元':n-Number(offset)}年`))||[['R',2018],['H',1988],['S',1925]].some(([era,offset])=>n>Number(offset)&&new RegExp(`(?<![A-Za-z0-9])${era}\\s*${n-Number(offset)}(?![0-9])`).test(original));}),'Year is not explicit in proof');
}
function arraySlot(field:string,v:any):string|null{return field==='amounts'?JSON.stringify([v.kind,v.fiscalYear]):field==='indicators'?JSON.stringify([v.name,v.fiscalYear]):field==='ratings'?JSON.stringify([v.kind,v.label]):null;}
function assertArrayValue(field:typeof arrays[number],value:any,proofs:EnrichmentProof[],verified:Map<string,EvaluationEvidence>,code:string){
 const e=field==='evidence'?value:value?.evidence;
 check(e&&proofs.some(p=>{const v=verified.get(key(code,p))!;return e.sourceUrl===v.sourceUrl&&e.sha256===v.sha256&&e.rawText===v.rawText&&e.cell===v.cell&&e.fetchedAt===v.fetchedAt&&e.format===v.format&&e.sourcePageUrl===v.sourcePageUrl&&e.page===v.page&&e.sheet===v.sheet;}),'Appended value evidence is not a verified proof');
 if((field==='amounts'||field==='indicators')&&value.fiscalYear!==null)assertExplicitYear(value.fiscalYear,proofs);
 const literal=(v:unknown)=>typeof v==='string'&&proofs.some(p=>p.quote.normalize('NFKC').includes(v.normalize('NFKC')));
 if(field==='indicators'){for(const f of ['target','actual','unit'])if(value[f]!==null)check(literal(value[f]),'Indicator value or unit is not literal');check(literal(String(value.name).replace(/^【(?:成果|活動)指標】/,'')),'Indicator name is not literal');}
 if(field==='ratings')check(literal(value.value),'Rating value is not literal');
 if(field==='amounts'&&value.amountYen!==null){const raw=String(value.rawValue).normalize('NFKC').replaceAll(',','');const units:Record<string,number>={'円':1,'千円':1000,'万円':10000,'百万円':1000000,'億円':100000000};check(/^-?\d+(?:\.\d+)?$/.test(raw)&&units[value.rawUnit]&&Number(raw)*units[value.rawUnit]===value.amountYen,'Amount unit conversion is not explicit');check(proofs.some(p=>p.quote.normalize('NFKC').includes(String(value.rawValue).normalize('NFKC')))&&proofs.some(p=>p.quote.includes(value.rawUnit)),'Amount raw value or unit lacks proof');}
}
export async function composeEnrichment(root:string,base:IntegrationAssets,inputs:Map<string,Buffer>,generatedAt:string){
 check(Number.isFinite(Date.parse(generatedAt)),'Invalid enrichment date');const parsed=[...inputs].sort(([a],[b])=>a.localeCompare(b)).map(([hash,bytes])=>{check(sha256(bytes)===hash,'Enrichment input hash mismatch');return parseInput(bytes);});const patches=parsed.flatMap(i=>i.patches);check(new Set(patches.map(p=>p.id)).size===patches.length,'Duplicate enrichment patch ID');
 const verified=await verifyProofs(root,patches),datasets=new Map<string,EvaluationDataset>(),originals=new Map<string,ProjectEvaluation>(),changed=new Set<string>();
 const statistics={patches:patches.length,changedRecords:0,filledFields:0,addedArrayItems:0,duplicateValues:0,filledFieldsByField:Object.fromEntries(fields.map(f=>[f,0])),addedArrayItemsByField:Object.fromEntries(arrays.map(f=>[f,0]))};
 for(const patch of patches){
  const bytes=base.shards.get(patch.municipalityCode);check(bytes,'Unknown enrichment municipality');
  if(!datasets.has(patch.municipalityCode)){const d=JSON.parse(bytes.toString())as EvaluationDataset;datasets.set(patch.municipalityCode,d);for(const p of d.projects)originals.set(p.id,structuredClone(p));}
  const d=datasets.get(patch.municipalityCode)!,p=d.projects.find(p=>p.id===patch.projectId),old=originals.get(patch.projectId);check(p&&old&&old.municipalityCode===patch.municipalityCode,'Unknown enrichment project');check(supplementalRecordSha256(old)===patch.beforeRecordSha256,'Enrichment base record hash mismatch');
  const normalizeName=(v:string)=>v.normalize('NFKC').replace(/\s/g,'');
  check(patch.identity.proofs.some(q=>recordEvidence(old).some(e=>e.sourceUrl===q.sourceUrl&&e.sha256===q.sourceSha256&&(e.rawText.includes(q.quote)||normalizeName(q.quote).includes(normalizeName(old.projectName))))),'Same-business proof is not bound to original record name or evidence');
  const identitySources=new Set(patch.identity.proofs.map(q=>JSON.stringify([q.sourceUrl,q.sourceSha256])));
  for(const q of patchProofs(patch))check(identitySources.has(JSON.stringify([q.sourceUrl,q.sourceSha256])),'New source needs same-business identity proof');
  for(const f of fields){const change=patch.set?.[f];if(!change)continue;check(old[f]===null,'Existing value replacement is forbidden');
   if(f==='evaluationYear'||f==='evaluatedFiscalYear')assertExplicitYear(change.value,change.proofs);
   else check(typeof change.value==='string'&&change.value.trim().length>0&&change.proofs.some(q=>q.quote.includes(String(change.value))),'Text enrichment must be a literal quote');
   if(p[f]!==null){check(p[f]===change.value,'Conflicting enrichment field values');statistics.duplicateValues++;}else{(p as any)[f]=change.value;statistics.filledFields++;statistics.filledFieldsByField[f]++;}
  }
  for(const f of arrays)for(const change of patch.append?.[f]??[]){assertArrayValue(f,change.value,change.proofs,verified,patch.municipalityCode);const target=p[f]as any[];const semantic=withoutEvidence(change.value);if(target.some(v=>withoutEvidence(v)===semantic)){statistics.duplicateValues++;continue;}const slot=arraySlot(f,change.value);check(slot===null||!target.some(v=>arraySlot(f,v)===slot),'Conflicting enrichment array value');target.push(structuredClone(change.value));statistics.addedArrayItems++;statistics.addedArrayItemsByField[f]++;}
  for(const q of patchProofs(patch)){const e=verified.get(key(patch.municipalityCode,q))!;if(!p.evidence.some(v=>JSON.stringify(v)===JSON.stringify(e))){p.evidence.push(e);statistics.addedArrayItems++;statistics.addedArrayItemsByField.evidence++;}}
  if(supplementalRecordSha256(p)!==patch.beforeRecordSha256)changed.add(p.id);
 }
 const shards=new Map(base.shards),rows=new Map(base.index.municipalities.map(r=>[r.municipalityCode,{...r}])),composed=new Map<string,Buffer>();
 for(const[code,d]of datasets){
  // Secondary evidence sources own zero projects; primary ownership and source counts stay unchanged.
  const known=new Set([...d.sources.flatMap(s=>s.documents.map(doc=>JSON.stringify([doc.url,doc.sha256]))),...d.projects.flatMap(p=>recordEvidence(originals.get(p.id)!).map(e=>JSON.stringify([e.sourceUrl,e.sha256])))]);
  for(const p of d.projects)for(const e of recordEvidence(p)){const k=JSON.stringify([e.sourceUrl,e.sha256]);if(known.has(k))continue;const proof=patches.filter(p=>p.municipalityCode===code).flatMap(patchProofs).find(q=>q.sourceUrl===e.sourceUrl&&q.sourceSha256===e.sha256)!;check(proof,'Missing enriched source proof');d.sources.push({id:`enrichment-${code}-${proof.sourceId}`,municipalityCode:code,municipalityName:p.municipalityName,sourcePageUrl:e.sourceUrl,evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:0,scope:'既存事業のフィールド補強の根拠資料。追加事業数は0。',message:'保存本文の引用を検証',lastAttemptAt:e.fetchedAt,lastSuccessAt:e.fetchedAt,documents:[{url:e.sourceUrl,format:e.format,status:'partial',sha256:e.sha256,fetchedAt:e.fetchedAt,projectCount:0,message:'補強根拠'}]});known.add(k);}
  d.generatedAt=generatedAt;const bytes=json(d),prior=rows.get(code)!;const row={...prior,datasetPath:`evaluations-composed/${code}-${sha256(bytes)}.json`,datasetBytes:bytes.length,datasetSha256:sha256(bytes),recordsWithSourceLabelledOutcomeIndicators:d.projects.filter(p=>p.indicators.some(i=>i.name.includes('【成果指標】'))).length};validateShardBytes(row,bytes);rows.set(code,row);shards.set(code,bytes);composed.set(code,bytes);
 }
 check([...shards.values()].reduce((n,b)=>n+b.length,0)<=LIMITS.totalBytes,'Enrichment shard aggregate limit');
 statistics.changedRecords=changed.size;
 const index={...base.index,generatedAt,municipalities:base.index.municipalities.map(r=>rows.get(r.municipalityCode)!),notes:[...base.index.notes,'Evidence-bound field enrichment; original records preserved in immutable prior layers; project counts unchanged.']};validateEvaluationIndex(index);const indexBytes=json(index);check(indexBytes.length<=LIMITS.indexBytes,'Enrichment index limit');
 const m:EnrichmentManifest={schemaVersion:1,kind:'evaluation_field_enrichment',baseIndex:base.index,baseIndexSha256:sha256(base.indexBytes),generatedAt,inputs:[...inputs].sort(([a],[b])=>a.localeCompare(b)).map(([hash,b])=>({path:`data/evaluations/enrichment-inputs/${hash}.json`,sha256:hash,bytes:b.length})),outputIndexSha256:sha256(indexBytes),shards:[...composed.keys()].sort().map(c=>rows.get(c)!),statistics};check(json(m).length<=MAX_MANIFEST,'Enrichment manifest limit');return{assets:{...base,index,indexBytes,shards},manifest:m,composed};
}
async function loadInputs(root:string,m:EnrichmentManifest){const inputs=new Map<string,Buffer>();let total=0;for(const i of m.inputs){check(/^[a-f0-9]{64}$/.test(i.sha256)&&i.path===`data/evaluations/enrichment-inputs/${i.sha256}.json`&&!inputs.has(i.sha256),'Invalid enrichment input path');const bytes=await readBoundedFile(join(root,i.path),LIMITS.totalBytes);check(bytes.length===i.bytes&&sha256(bytes)===i.sha256,'Enrichment input mismatch');total+=bytes.length;check(total<=LIMITS.totalBytes,'Enrichment aggregate input limit');inputs.set(i.sha256,bytes);}return inputs;}
export async function verifyEnrichedEvaluations(root:string):Promise<IntegrationAssets>{const m=await manifest(root);if(!m)return verifySupplementalEvaluations(root);const base=await readEnrichmentBase(root),inputs=await loadInputs(root,m);const rebuilt=await composeEnrichment(root,base,inputs,m.generatedAt);check(json(rebuilt.manifest).equals(json(m)),'Enrichment provenance mismatch');check(rebuilt.assets.indexBytes.equals(await readBoundedFile(join(root,'apps/web/public/evaluations-index.json'),LIMITS.indexBytes)),'Enrichment index mismatch');for(const r of m.shards)check(rebuilt.composed.get(r.municipalityCode)!.equals(await readBoundedFile(join(root,'apps/web/public',r.datasetPath!),LIMITS.shardBytes)),'Enrichment composed shard mismatch');return rebuilt.assets;}
/** Reapply the same immutable proof inputs after an append; stale record hashes still fail closed. */
export async function rebaseExistingEnrichment(root:string,base:IntegrationAssets){
 const old=await manifest(root);if(!old)return null;
 const generatedAt=Date.parse(base.index.generatedAt)>Date.parse(old.generatedAt)?base.index.generatedAt:old.generatedAt;
 return composeEnrichment(root,base,await loadInputs(root,old),generatedAt);
}
export async function importEnrichment(options:{root:string;inputFiles:string[];generatedAt:string}){
 const root=resolve(options.root),current=await verifyEnrichedEvaluations(root),old=await manifest(root),inputs=old?await loadInputs(root,old):new Map<string,Buffer>();
 for(const path of options.inputFiles){const rel=relative(join(root,'apps/web/public'),resolve(path));check(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'Enrichment input cannot be in public');const b=await readBoundedFile(path,LIMITS.totalBytes);inputs.set(sha256(b),b);}
 if(old&&inputs.size===old.inputs.length)return current;const base=old?await readEnrichmentBase(root):current;check(inputs.size>0,'No enrichment input');check([...inputs.values()].reduce((n,b)=>n+b.length,0)<=LIMITS.totalBytes,'Enrichment input limit');const result=await composeEnrichment(root,base,inputs,options.generatedAt);
 const pub=join(root,'apps/web/public'),data=join(root,'data/evaluations');check((await readBoundedFile(join(pub,'evaluations-index.json'),LIMITS.indexBytes)).equals(current.indexBytes),'Index changed during enrichment');
 for(const dir of [join(data,'enrichment-inputs'),join(pub,'evaluations-composed')]){await mkdir(dir,{recursive:true});const stat=await lstat(dir);check(stat.isDirectory()&&!stat.isSymbolicLink(),'Unsafe enrichment output directory');}
 const stage=await mkdtemp(join(data,'.enrichment-'));async function immutable(path:string,b:Buffer){try{await writeFile(path,b,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;check((await readBoundedFile(path,LIMITS.totalBytes)).equals(b),'Immutable enrichment asset conflict');}}
 try{for(const[hash,b]of inputs)await immutable(join(data,'enrichment-inputs',hash+'.json'),b);for(const[code,b]of result.composed)await immutable(join(pub,result.assets.index.municipalities.find(r=>r.municipalityCode===code)!.datasetPath!),b);await writeFile(join(stage,'manifest'),json(result.manifest));await writeFile(join(stage,'index'),result.assets.indexBytes);await rename(join(stage,'manifest'),join(root,ENRICHMENT_MANIFEST));await rename(join(stage,'index'),join(pub,'evaluations-index.json'));}finally{await rm(stage,{recursive:true,force:true});}return verifyEnrichedEvaluations(root);
}
