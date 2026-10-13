/** Reproducible offline extraction from hash-checked, already published text assets. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './evaluations/national-integration';
import type { EvaluationDataset } from '../../web/src/types/evaluation';
import type { EvidenceIndex, MunicipalityEvidence, DocumentText } from '../../web/src/types/evaluationEvidence';
import { type CachedInput } from './evaluations/expansion/shared';
import { extractOgano } from './evaluations/expansion/ogano';
import { extractMobara } from './evaluations/expansion/mobara';
import { extractAkitakata } from './evaluations/expansion/akitakata';
import { extractMisato } from './evaluations/expansion/misato';
import { extractKaizu } from './evaluations/expansion/kaizu';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const args=process.argv.slice(2);
if(args.length!==4 || args[0]!=='--output-dir' || args[2]!=='--generated-at' || !Number.isFinite(Date.parse(args[3]))) throw new Error('Use --output-dir <dir> --generated-at <ISO timestamp>');
const output=resolve(args[1]); const generatedAt=args[3];
const base=join(root,'apps/web/public/evaluation-evidence');
const index:EvidenceIndex=JSON.parse(await readFile(join(base,'index.json'),'utf8'));
const audit:{code:string;documents:unknown[];records:number;withAmounts:number;withActualAmounts:number;withIndicators:number;withNumericIndicators:number;withOutcomeIndicators:number;withOutcomes:number;withRatings:number;duplicates:string[]}[]=[];
await mkdir(output,{recursive:true});
for(const code of ['05434','11365','12210','21221','34214']){
 const row=index.municipalities.find(r=>r.municipalityCode===code)!;
 const muniBytes=await readFile(join(base,row.shardPath));
 if(sha256(muniBytes)!==row.shardSha256 || muniBytes.length!==row.shardBytes)throw new Error('Municipality hash mismatch');
 const muni:MunicipalityEvidence=JSON.parse(muniBytes.toString());
 const inputs:CachedInput[]=[];
 for(const source of muni.sources){
  if(source.text.status!=='available'||source.format!=='pdf')continue;
  if(!source.text.assetPath?.match(/^documents\/[a-f0-9]{24}\.json$/))throw new Error('Unexpected asset path');
  const bytes=await readFile(join(base,source.text.assetPath));
  if(sha256(bytes)!==source.text.assetSha256||bytes.length!==source.text.assetBytes)throw new Error('Text asset hash mismatch');
  const doc:DocumentText=JSON.parse(bytes.toString());
  if(doc.sourceId!==source.id||doc.sourceUrl!==source.url||doc.municipalityCode!==code||doc.sourceSha256!==source.acquisition.sourceSha256||sha256(Buffer.from(doc.text))!==doc.textSha256||!source.acquisition.fetchedAt)throw new Error('Source identity mismatch');
  inputs.push({municipalityCode:code,municipalityName:row.municipalityName,sourceId:source.id,sourceUrl:source.url,sourcePageUrl:source.url,sourceSha256:doc.sourceSha256,fetchedAt:source.acquisition.fetchedAt,format:'pdf',text:doc.text,truncated:doc.truncated});
 }
 inputs.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 const dataset:EvaluationDataset={schemaVersion:1,generatedAt,sources:[],projects:[]};
 const seen=new Set<string>();const duplicates:string[]=[];const documents:unknown[]=[];
 for(const input of inputs){
  const projects=code==='05434'?extractMisato(input):code==='11365'?extractOgano(input):code==='12210'?extractMobara(input):code==='34214'?extractAkitakata(input):extractKaizu(input,inputs.find(d=>d.sourceId==='982b3dbd86b80c24870b5012'));
  const unique=projects.filter(p=>{const key=JSON.stringify([p.projectCode,p.projectName,p.evaluationYear]);if(seen.has(key))throw new Error(`Cross-document duplicate requires review: ${code} ${key}`);seen.add(key);return true;});
  if(!unique.length)continue;
  for(const p of unique){
   for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
    const src=inputs.find(d=>d.sourceUrl===e.sourceUrl&&d.sourceSha256===e.sha256);
    const pos=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
    if(!src||!pos||src.text.slice(Number(pos[1]),Number(pos[2]))!==e.rawText)throw new Error(`Evidence mismatch ${p.id}`);
   }
  }
  dataset.projects.push(...unique);
  dataset.sources.push({id:`cached-${code}-${input.sourceId}`,municipalityCode:code,municipalityName:row.municipalityName,sourcePageUrl:input.sourcePageUrl,evaluationYear:unique.every(p=>p.evaluationYear===unique[0].evaluationYear)?unique[0].evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:unique.length,scope:'保存済み本文の識別可能な個票のみ。全事業・最新年度の網羅性は未確認。',message:'追加の原典取得なし。保存済み抽出テキストとの文字位置照合済み。PDF原本との再照合は未実施。',lastAttemptAt:input.fetchedAt,lastSuccessAt:input.fetchedAt,documents:[{url:input.sourceUrl,format:'pdf',status:'partial',sha256:input.sourceSha256,fetchedAt:input.fetchedAt,projectCount:unique.length,message:'保存済み本文から部分構造化'}]});
  documents.push({sourceId:input.sourceId,sourceUrl:input.sourceUrl,sourceSha256:input.sourceSha256,textSha256:sha256(Buffer.from(input.text)),records:unique.length,truncated:input.truncated});
 }
 const ps=dataset.projects;
 audit.push({code,documents,records:ps.length,withAmounts:ps.filter(p=>p.amounts.some(a=>a.amountYen!==null)).length,withActualAmounts:ps.filter(p=>p.amounts.some(a=>a.kind==='actual'&&a.amountYen!==null)).length,withIndicators:ps.filter(p=>p.indicators.length).length,withNumericIndicators:ps.filter(p=>p.indicators.some(i=>i.actual!==null||i.target!==null)).length,withOutcomeIndicators:ps.filter(p=>p.indicators.some(i=>i.name.includes('【成果指標】'))).length,withOutcomes:ps.filter(p=>p.outcomes!==null).length,withRatings:ps.filter(p=>p.ratings.length).length,duplicates});
 if(!ps.length)throw new Error(`No records for ${code}`);
 await writeFile(join(output,`${code}.json`),JSON.stringify(dataset)+'\n');
}
await writeFile(join(output,'../extraction-audit.json'),JSON.stringify({generatedAt,offlineOnly:true,municipalities:audit},null,2)+'\n');
console.log(JSON.stringify(audit.map(({documents,...rest})=>({...rest,documents:documents.length})),null,2));
