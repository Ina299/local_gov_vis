/** Independent before/after field audit; record counts never stand in for filled content. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyIntegratedEvaluations,sha256} from './evaluations/national-integration';
import {ENRICHMENT_MANIFEST,type EnrichmentManifest} from './evaluations/enrichment-integration';
import {summarizeRecords} from './audit-cached-expansion';
import type {ProjectEvaluation,EvaluationDataset} from '../../web/src/types/evaluation';
const scalars=['purpose','activities','outcomes','evaluationYear','evaluatedFiscalYear'] as const;
const arrays=['amounts','indicators','ratings','evidence'] as const;
const present=(s:string|null)=>s!==null&&s.trim().length>0;
function contentCoverage(rows:ProjectEvaluation[]){return {
 nameAndMetadataOnly:rows.filter(p=>!scalars.slice(0,3).some(k=>present(p[k]as string|null))&&!p.amounts.length&&!p.indicators.length&&!p.ratings.length).length,
 narrativeFields:rows.filter(p=>[p.purpose,p.activities,p.outcomes].some(present)).length,
 rawEvidenceText:rows.filter(p=>p.evidence.some(e=>e.rawText.trim())).length,...summarizeRecords(rows)};}
export async function auditEnrichedEvaluations(root:string){
 const assets=await verifyIntegratedEvaluations(root);
 const m=JSON.parse(await readFile(join(root,ENRICHMENT_MANIFEST),'utf8'))as EnrichmentManifest;
 if(sha256(Buffer.from(JSON.stringify(m.baseIndex)+'\n'))!==m.baseIndexSha256)throw Error('Base index mismatch');
 const before:ProjectEvaluation[]=[],after:ProjectEvaluation[]=[];const changedIds:string[]=[];const towns:string[]=[];
 const scalarCounts=Object.fromEntries(scalars.map(k=>[k,0]))as Record<typeof scalars[number],number>;
 const arrayCounts=Object.fromEntries(arrays.map(k=>[k,0]))as Record<typeof arrays[number],number>;
 const detail=[];
 for(const row of m.baseIndex.municipalities){if(!row.datasetPath)continue;
  const bytes=await readFile(join(root,'apps/web/public',row.datasetPath));if(bytes.length!==row.datasetBytes||sha256(bytes)!==row.datasetSha256)throw Error('Frozen pre-enrichment asset changed');
  const old=JSON.parse(bytes.toString())as EvaluationDataset;const current=JSON.parse(assets.shards.get(row.municipalityCode)!.toString())as EvaluationDataset;
  if(old.projects.length!==current.projects.length)throw Error('Enrichment changed record count');let changed=0;
  for(let n=0;n<old.projects.length;n++){
   const a=old.projects[n],b=current.projects[n];if(a.id!==b.id)throw Error('Enrichment changed record order/identity');before.push(a);after.push(b);
   for(const k of Object.keys(a)as Array<keyof ProjectEvaluation>){if((scalars as readonly string[]).includes(k)||(arrays as readonly string[]).includes(k))continue;if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error(`Unexpected metadata change: ${a.id} ${k}`);}
   const addedFields:string[]=[];
   for(const k of scalars){if(a[k]!==null&&a[k]!==b[k])throw Error(`Existing field replaced: ${a.id} ${k}`);if(a[k]===null&&b[k]!==null){scalarCounts[k]++;addedFields.push(k);}}
   const addedItems:Record<string,number>={};
   for(const k of arrays){if(b[k].length<a[k].length||JSON.stringify(b[k].slice(0,a[k].length))!==JSON.stringify(a[k]))throw Error(`Existing array altered: ${a.id} ${k}`);const n=b[k].length-a[k].length;arrayCounts[k]+=n;if(n)addedItems[k]=n;}
   if(JSON.stringify(a)!==JSON.stringify(b)){changedIds.push(a.id);changed++;detail.push({municipalityCode:a.municipalityCode,projectId:a.id,filledFields:addedFields,addedItems});}
  }
  if(changed)towns.push(row.municipalityCode);
 }
 if(before.length!==m.baseIndex.primaryEvaluationRecords||after.length!==before.length||assets.index.primaryMunicipalities!==m.baseIndex.primaryMunicipalities)throw Error('Enrichment must retain the complete pre-enrichment scope');
 const narrativeFilled=scalarCounts.purpose+scalarCounts.activities+scalarCounts.outcomes;
 return {schemaVersion:1,baseIndexSha256:m.baseIndexSha256,indexSha256:sha256(assets.indexBytes),generatedAt:m.generatedAt,
  definitions:{filledFields:'null scalar fields filled; amount/indicator/rating items counted separately; evidence additions are not substantive filled fields',counts:'Annual evaluation records, not unique all-year businesses; coverage categories overlap',narrative:'Nonempty purpose, activities or outcomes; original text quotation is counted separately',money:'No totals are summed across years or kinds; actual is not necessarily direct cost'},
  changedMunicipalities:towns.length,changedRecords:changedIds.length,filledScalarFields:scalarCounts,addedArrayItems:arrayCounts,
  substantiveFilledFields:Object.values(scalarCounts).reduce((a,b)=>a+b,0)+arrayCounts.amounts+arrayCounts.indicators+arrayCounts.ratings,narrativeFilledFields:narrativeFilled,
  before:contentCoverage(before),after:contentCoverage(after),details:detail};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [root,output]=process.argv.slice(2);if(!root||!output)throw Error('Use <repository> <output-json>');const result=await auditEnrichedEvaluations(resolve(root));await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({changedRecords:result.changedRecords,fields:result.substantiveFilledFields}));}
