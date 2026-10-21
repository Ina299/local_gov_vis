/** Reproducible offline extraction from hash-checked, already published text assets. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './evaluations/national-integration';
import type { EvaluationDataset, ProjectEvaluation } from '../../web/src/types/evaluation';
import type { EvidenceIndex, MunicipalityEvidence, DocumentText } from '../../web/src/types/evaluationEvidence';
import { type CachedInput } from './evaluations/expansion/shared';
import { extractOgano } from './evaluations/expansion/ogano';
import { extractMobara } from './evaluations/expansion/mobara';
import { extractAkitakata } from './evaluations/expansion/akitakata';
import { extractMisato } from './evaluations/expansion/misato';
import { extractKaizu } from './evaluations/expansion/kaizu';
import { extractShinjo } from './evaluations/expansion/shinjo';
import { extractTakanabe } from './evaluations/expansion/takanabe';
import { extractOtaki } from './evaluations/expansion/otaki';
import { extractUonuma } from './evaluations/expansion/uonuma';
import { extractShimanto } from './evaluations/expansion/shimanto';
import { extractKuki } from './evaluations/expansion/kuki';
import { extractMiyazaki } from './evaluations/expansion/miyazaki';
import { extractKasukabe } from './evaluations/expansion/kasukabe';
import { extractHakodate } from './evaluations/expansion/hakodate';
import { extractHino } from './evaluations/expansion/hino';
import { extractIkoma } from './evaluations/expansion/ikoma';
import { extractTakahashi } from './evaluations/expansion/takahashi';
import { extractTateyama } from './evaluations/expansion/tateyama';
import { extractShowa } from './evaluations/expansion/showa';
import { extractTanabe } from './evaluations/expansion/tanabe';
import { extractChigasaki } from './evaluations/expansion/chigasaki';
import { extractTakko } from './evaluations/expansion/takko';
import { extractHigashihiroshima } from './evaluations/expansion/higashihiroshima';
import { extractDaigo } from './evaluations/expansion/daigo';
import { extractKasuya } from './evaluations/expansion/kasuya';
import { extractKomagane } from './evaluations/expansion/komagane';
import { extractIsesaki } from './evaluations/expansion/isesaki';
import { extractMarugame } from './evaluations/expansion/marugame';
import { extractChikushino } from './evaluations/expansion/chikushino';
import { extractSannohe } from './evaluations/expansion/sannohe';
import { extractYazu } from './evaluations/expansion/yazu';
import { extractHadano } from './evaluations/expansion/hadano';
import { extractHita } from './evaluations/expansion/hita';
import { extractIizuka } from './evaluations/expansion/iizuka';
import { extractMunakata } from './evaluations/expansion/munakata';
import { extractTomisato } from './evaluations/expansion/tomisato';
import { extractHanamaki } from './evaluations/expansion/hanamaki';
import { extractOfunato } from './evaluations/expansion/ofunato';
import { extractMinamiashigara } from './evaluations/expansion/minamiashigara';
import { extractHirao } from './evaluations/expansion/hirao';
import { extractKamisato } from './evaluations/expansion/kamisato';
import { extractToshima } from './evaluations/expansion/toshima';
import { extractKumamoto } from './evaluations/expansion/kumamoto';
import { extractMiura } from './evaluations/expansion/miura';
import { extractKomatsu } from './evaluations/expansion/komatsu';
import { extractOyama } from './evaluations/expansion/oyama';
import { extractNanbuAomori } from './evaluations/expansion/nanbu-aomori';
import { extractNanbuYamanashi } from './evaluations/expansion/nanbu-yamanashi';
import { extractYuzawa } from './evaluations/expansion/yuzawa';
import { extractMisatoSaitama } from './evaluations/expansion/misato-saitama';
import { extractTaito } from './evaluations/expansion/taito';
import { extractNikaho } from './evaluations/expansion/nikaho';
const extractors: Record<string,(input:CachedInput, inputs:CachedInput[])=>ProjectEvaluation[]> = {
 '11381':extractMisatoSaitama,'13106':extractTaito,'05214':extractNikaho,
 '03205':extractHanamaki,
 '03203':extractOfunato,
 '14217':extractMinamiashigara,
 '35344':extractHirao,
 '11385':extractKamisato,
 '13116':extractToshima,
 '43100':extractKumamoto,
 '14210':extractMiura,
 '17203':extractKomatsu,
 '09208':extractOyama,
 '02445':extractNanbuAomori,
 '19366':extractNanbuYamanashi,
 '15461':extractYuzawa,
 '05434':extractMisato,'11365':extractOgano,'12210':extractMobara,'34214':extractAkitakata,
 '21221':(input,inputs)=>extractKaizu(input,inputs.find(d=>d.sourceId==='982b3dbd86b80c24870b5012')),
 '01202':extractHakodate,'06205':extractShinjo,'11214':extractKasukabe,'11232':extractKuki,
 '12441':extractOtaki,'13212':extractHino,'15225':extractUonuma,'39412':extractShimanto,
 '45201':extractMiyazaki,'45401':extractTakanabe,'29209':extractIkoma,'33209':extractTakahashi,
 '10204':extractIsesaki,'37202':extractMarugame,'40217':extractChikushino,
 '08364':extractDaigo,'40349':extractKasuya,'20210':extractKomagane,
 '14207':extractChigasaki,'02443':extractTakko,'34212':extractHigashihiroshima,
 '02441':extractSannohe,
 '31329':extractYazu,
 '14211':extractHadano,
 '44204':extractHita,
 '40205':extractIizuka,
 '40220':extractMunakata,
 '12233':extractTomisato,
 '16323':extractTateyama,'07446':extractShowa,'30206':extractTanabe,
};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const args=process.argv.slice(2);
if(![4,6].includes(args.length) || args[0]!=='--output-dir' || args[2]!=='--generated-at' || !Number.isFinite(Date.parse(args[3]))) throw new Error('Use --output-dir <dir> --generated-at <ISO timestamp>');
const output=resolve(args[1]); const generatedAt=args[3];
if(args.length===6 && (args[4]!=='--codes'||!/^[0-9]{5}(,[0-9]{5})*$/.test(args[5])))throw new Error('Invalid --codes');
const codes=args.length===6?args[5].split(','):['05434','11365','12210','21221','34214'];
const base=join(root,'apps/web/public/evaluation-evidence');
const index:EvidenceIndex=JSON.parse(await readFile(join(base,'index.json'),'utf8'));
const audit:{code:string;documents:unknown[];records:number;withAmounts:number;withActualAmounts:number;withIndicators:number;withNumericIndicators:number;withOutcomeIndicators:number;withOutcomes:number;withRatings:number;duplicates:string[]}[]=[];
await mkdir(output,{recursive:true});
for(const code of codes){
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
  if(!extractors[code])throw new Error(`Unsupported municipality: ${code}`);
  const projects=extractors[code](input,inputs);
  const unique=projects.filter(p=>{const key=JSON.stringify([p.projectCode,p.projectName,p.evaluationYear,p.evaluatedFiscalYear]);if(seen.has(key))throw new Error(`Cross-document duplicate requires review: ${code} ${key}`);seen.add(key);return true;});
  if(!unique.length)continue;
  for(const p of unique){
   for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
    const src=inputs.find(d=>d.sourceUrl===e.sourceUrl&&d.sourceSha256===e.sha256);
    const pos=e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
    if(!src||!pos||src.text.slice(Number(pos[1]),Number(pos[2]))!==e.rawText)throw new Error(`Evidence mismatch ${p.id}`);
   }
  }
  dataset.projects.push(...unique);
  dataset.sources.push({id:`cached-${code}-${input.sourceId}`,municipalityCode:code,municipalityName:row.municipalityName,sourcePageUrl:input.sourcePageUrl,evaluationYear:unique.every(p=>p.evaluationYear===unique[0].evaluationYear)?unique[0].evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:unique.length,scope:code==='35344'?'施策評価表の関係主要事業欄にある事業別評価行の部分構造化。施策全体の成果は転用せず、完全個票ではありません。':code==='15461'?'事務事業評価結果一覧の事業別一次評価（部分抽出・完全個票ではない）':code==='19366'?'教育点検評価の独立評価単位を部分構造化。複数施設・活動を含む単位があり、単一予算事業数とは一致しません。':code==='44204'?'施策調書内の個別事業枠の部分構造化。列混在・名称改行等は保留、全件完了ではありません。':code==='14211'?'大学連携施策の個別事業票を部分構造化。大学別再掲を統合し、部分経費は数値化せず原文保持。':code==='40220'?'決算成果報告書の主要事業詳細を部分構造化。補足表の列混在は保留。全事業の網羅性は未確認。':['05214','13212','40349','20210','37202','40217'].includes(code)?'事業別の市民・議会・外部評価意見の部分レコード。完全個票ではありません。全事業・最新年度の網羅性は未確認。':code==='34212'?'目的別事業群のうち、個別事業の詳細節を部分構造化。群合計の配分や一覧行の計上は行わない。全事業・最新年度の網羅性は未確認。':'保存済み本文の識別可能な個票のみ。全事業・最新年度の網羅性は未確認。',message:'追加の原典取得なし。保存済み抽出テキストとの文字位置照合済み。PDF原本との再照合は未実施。',lastAttemptAt:input.fetchedAt,lastSuccessAt:input.fetchedAt,documents:[{url:input.sourceUrl,format:'pdf',status:'partial',sha256:input.sourceSha256,fetchedAt:input.fetchedAt,projectCount:unique.length,message:'保存済み本文から部分構造化'}]});
  documents.push({sourceId:input.sourceId,sourceUrl:input.sourceUrl,sourceSha256:input.sourceSha256,textSha256:sha256(Buffer.from(input.text)),records:unique.length,truncated:input.truncated});
 }
 if(['29209','10204','37202','44204'].includes(code)) {
  const referenced=new Set(dataset.projects.flatMap(p=>[...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)].map(e=>e.sourceUrl)));
  for(const input of inputs.filter(i=>referenced.has(i.sourceUrl)&&!dataset.sources.some(s=>s.documents.some(d=>d.url===i.sourceUrl)))){
   dataset.sources.push({id:`cached-${code}-${input.sourceId}`,municipalityCode:code,municipalityName:row.municipalityName,sourcePageUrl:input.sourceUrl,evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:0,scope:'同一事業の資料横断再掲。事業件数は代表資料に計上し、この資料の証拠も当該事業に保持。',message:'追加取得なし。保存済み本文照合。',lastAttemptAt:input.fetchedAt,lastSuccessAt:input.fetchedAt,documents:[{url:input.sourceUrl,format:'pdf',status:'partial',sha256:input.sourceSha256,fetchedAt:input.fetchedAt,projectCount:0,message:'代表資料の事業へ証拠を統合'}]});
   documents.push({sourceId:input.sourceId,sourceUrl:input.sourceUrl,sourceSha256:input.sourceSha256,textSha256:sha256(Buffer.from(input.text)),records:0,truncated:input.truncated});
  }
 }
 const ps=dataset.projects;
 audit.push({code,documents,records:ps.length,withAmounts:ps.filter(p=>p.amounts.some(a=>a.amountYen!==null)).length,withActualAmounts:ps.filter(p=>p.amounts.some(a=>a.kind==='actual'&&a.amountYen!==null)).length,withIndicators:ps.filter(p=>p.indicators.length).length,withNumericIndicators:ps.filter(p=>p.indicators.some(i=>i.actual!==null||i.target!==null)).length,withOutcomeIndicators:ps.filter(p=>p.indicators.some(i=>i.name.includes('【成果指標】'))).length,withOutcomes:ps.filter(p=>p.outcomes!==null).length,withRatings:ps.filter(p=>p.ratings.length).length,duplicates});
 if(!ps.length)throw new Error(`No records for ${code}`);
 await writeFile(join(output,`${code}.json`),JSON.stringify(dataset)+'\n');
}
await writeFile(join(output,'../extraction-audit.json'),JSON.stringify({generatedAt,offlineOnly:true,municipalities:audit},null,2)+'\n');
console.log(JSON.stringify(audit.map(({documents,...rest})=>({...rest,documents:documents.length})),null,2));
