import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const YEARS:Record<string,[number|null,number]>={
 'e6277dae34d8d10749eae9ad':[2016,2015], '0daf8cb52db89955f49533d9':[2017,2016], '0ab7e3aeadf079ad86c5454b':[2018,2017], '624788e99c62d521d74014ca':[2019,2018],
 'd5cc9336da68dc2e05ac5caa':[null,2020], 'a59af4bed8ce7d94ef5f1a43':[null,2021], 'c00670d1b9d7710163b5ba6f':[null,2022], '0c67ee79add79c827c2638b8':[null,2023],
};
export function extractMiyakoSupplement(input:CachedInput):ProjectEvaluation[]{
 const y=YEARS[input.sourceId];if(input.municipalityCode!=='03202'||!y)return [];
 const out:ProjectEvaluation[]=[];
 if(y[1]<2020){
  for(const m of input.text.matchAll(/^(\d+) ([^\s]+(?:事業|費|金|活動|推進|支援|運営|整備|対策|管理|制度)) ([^\n]*?)(現状のまま継続|改善しながら継続|終了|縮小|廃止|拡充) ([^\s]+)$/gm)){
   if(input.truncated&&m.index!+m[0].length===input.text.length)continue;
   if(!/(課|室|所|局|館|センター)$/.test(m[5]))continue;
   const p=project(input,`${y[1]}:${m[1]}`,m[2],y[0],m[0],m.index);p.department=m[5];p.evaluatedFiscalYear=y[1];
   p.ratings.push({kind:'self',label:'総合評価・方向性',value:m[4],scale:null,evidence:evidence(input,m[0],m.index)});out.push(p);
  }
 }else{
  // Evaluation rows have two era-coded start/end columns; future-plan rows do not contain the evaluation pair.
  for(const m of input.text.matchAll(/^(\d+) ([^\s]+) (継続|新規) ([HRHＲＨ]\d+|－|―) ([HRHＲＨ]\d+|－|―) ([^\s]+) ([\d,]+) ([^\n]+)$/gm)){
   if(input.truncated&&m.index!+m[0].length===input.text.length)continue;
   if(!/(課|室|所|局|館|センター)$/.test(m[2])||!/[ぁ-んァ-ヶ一-龥]/.test(m[6]))continue;
   const ratings=[...m[8].matchAll(/(現状維持|拡充\/改善|縮小|休廃止\/終了|無)(?= |$)/g)];
   if(ratings.length!==2)continue;
   const p=project(input,`${y[1]}:${m[1]}`,m[6],null,m[0],m.index);p.department=m[2];p.evaluatedFiscalYear=y[1];
   ratings.forEach((r,j)=>p.ratings.push({kind:'self',label:j?'コストの方向性':'成果の方向性',value:r[1],scale:null,evidence:evidence(input,m[0],m.index)}));out.push(p);
  }
 }
 if(input.sourceId==='624788e99c62d521d74014ca'){
  for(const m of input.text.matchAll(/^([ⅠⅡⅢⅣⅤⅥⅦ]+) (\d+) ([①②③④⑤⑥⑦⑧⑨⑩]+) ([^\s]+(?:事業|費|金|活動|支援|運営|整備|対策|管理|制度)) ([^\s]+(?:課|室|所|局|館|センター))$/gm)){
   const p=project(input,`2018:${m.index}`,m[4],2019,m[0],m.index);p.evaluatedFiscalYear=2018;p.department=m[5];const prior=out.find(q=>q.evaluatedFiscalYear===2018&&q.projectName===p.projectName&&q.department===p.department);if(prior){prior.evidence.push(...p.evidence);continue;}p.warnings.push('令和元年度表の同一行に確認できる事務事業名と担当課のみ。上位基本事業は除外し、改行を跨ぐ総合評価と本文は結合しません。');out.push(p);
  }
 }
 const seen=new Set<string>();return out.filter(p=>{if(seen.has(p.projectCode!))throw new Error('Miyako repeated row number');seen.add(p.projectCode!);p.evidence.push(evidence(input,input.text.slice(0,1000),0));if(input.sourceId==='e6277dae34d8d10749eae9ad')p.evidence.push(evidence(input,'施策の体系・評価（平成27年度事業）'));p.warnings.push('原表の施策・基本事業・事務事業が交差するため番号・名称・担当課・評価が同一行で確定する行のみ。改行で切れた名称・評価は除外。事業費の予算決算種別や他列の数値は推測しません。');return true;});
}
