import {readFileSync,writeFileSync,existsSync}from'node:fs';import{createHash}from'node:crypto';
import{sections,fields}from'../../src/evaluations/enrichment/assignment4';
// Run from repo root: node --import tsx apps/crawler/scripts/enrichment/build-assignment4.ts <output-dir> [repo-root]
const root=process.argv[3]??process.cwd(),dir=process.argv[2];if(!dir)throw Error('output directory argument required');const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const index=existsSync(root+'/data/evaluations/enrichment-provenance.json')?read(root+'/data/evaluations/enrichment-provenance.json').baseIndex:read(root+'/apps/web/public/evaluations-index.json'),assignment=read(dir+'/assignment-4.json');const norm=(s:string)=>s.normalize('NFKC').replace(/\s+/g,'');const datasets=new Map();const patches=new Map<string,any>(),reviews=[];
for(const item of assignment){
 const doc=read(root+'/apps/web/public/evaluation-evidence/documents/'+item.documentId+'.json');
 if(!datasets.has(item.code)){const e=index.municipalities.find((e:any)=>e.municipalityCode===item.code);datasets.set(item.code,e?.datasetPath?read(root+'/apps/web/public/'+e.datasetPath).projects:[]);}
 const projects=datasets.get(item.code);const linked=projects.filter((p:any)=>p.evidence.some((e:any)=>e.sourceUrl===doc.sourceUrl&&e.sha256===doc.sourceSha256));
 const proof=(quote:string,start:number)=>{if(doc.text.slice(start,start+quote.length)!==quote)throw Error('badquote');return{sourceId:item.documentId,sourceUrl:doc.sourceUrl,sourceSha256:doc.sourceSha256,textSha256:doc.textSha256,quote,cell:`extracted-text:chars:${start}-${start+quote.length}`};};
 const blocks=sections(item.code,doc.text);let matched=0,ambiguous=0,filled=0;const ids=new Set<string>(),quotes:string[]=[];
 for(const s of blocks){const candidates=linked.filter((p:any)=>s.code?p.projectCode===s.code:s.name?norm(p.projectName)===norm(s.name):false);if(candidates.length!==1){ambiguous++;continue;}const p=candidates[0];matched++;let proposals=fields(item.code,s);
 if(doc.truncated&&s.start+s.text.length>=doc.text.length)proposals=proposals.filter(f=>f.start+f.quote.length<doc.text.length-1);
 const id=`assignment4:${p.municipalityCode}:${p.id}`;let patch=patches.get(id);
 for(const f of proposals){if(p[f.field]!==null||patch?.set?.[f.field])continue;
  const identity=s.text.slice(0,Math.min(s.text.length,600));
  if(!patch){patch={id,municipalityCode:p.municipalityCode,projectId:p.id,beforeRecordSha256:hash(JSON.stringify(p)+'\n'),identity:{reason:'既存レコードと原典URL・原典ハッシュが一致し、同一資料内の事業コード又は事業名が一意に対応する独立評価票の項目を補強する。',proofs:[proof(identity,s.start)]},set:{}};patches.set(id,patch);}
  patch.set[f.field]={value:f.value,proofs:[proof(f.quote,f.start)]};ids.add(id);filled++;if(quotes.length<3)quotes.push(f.quote.slice(0,Math.min(f.quote.length,180)));
 }
 }
 const configured=blocks.length>0;
 const noLinked=linked.length===0;
 const fallback=item.evidenceQuotes.filter((q:string)=>doc.text.includes(q));if(quotes.length===0)quotes.push(...fallback.slice(0,3));if(quotes.length===0)quotes.push(doc.text.slice(0,150));
 reviews.push({documentId:item.documentId,code:item.code,status:filled?'enriched':noLinked?'held':'reviewed_no_change',projectIds:[...ids].map(id=>patches.get(id).projectId),patchIds:[...ids],reason:filled?`現公開レコードと出典URL・ハッシュ一致。独立節${blocks.length}件を照合し${matched}件がコード又は名称で一意対応。null文章項目${filled}箇所に見出し付き完全一致原文を補強。`:noLinked?`現公開レコードで同一URL・原典ハッシュの証拠を持つ票がなく、既存事業への同定根拠が確立していない。前回の確認: ${item.reason}`:configured?`独立節${blocks.length}件・既存対応${matched}件を確認したが、明確境界の文章欄は既存値あり又は列混線等で安全な新規null補強なし。`: `同一URL・原典ハッシュで既存${linked.length}件を照合。${item.reason} 未分離欄の見出しと本文構造を確認したが、現在の抽出規則で欄境界を確定して補強する段階に至っていない。`,evidenceQuotes:quotes,remainingScope:`既存値を置換しない。${ambiguous?`独立節のうち${ambiguous}件は名称折返し・同名・コード照合不一致により未補強。`:''}${item.remainingScope} 費用・数値指標は既存の列対応を超えて推測追加していない。`});
}
writeFileSync(dir+'/patches-4.json',JSON.stringify({schemaVersion:1,generatedAt:process.env.ENRICHMENT_GENERATED_AT??'2026-10-18T23:00:00.000Z',patches:[...patches.values()]},null,2)+'\n');writeFileSync(dir+'/review-4.json',JSON.stringify(reviews,null,2)+'\n');console.log(JSON.stringify({patches:patches.size,fields:[...patches.values()].reduce((n,p)=>n+Object.keys(p.set).length,0),status:reviews.reduce((a:any,r:any)=>(a[r.status]=(a[r.status]||0)+1,a),{})}));
