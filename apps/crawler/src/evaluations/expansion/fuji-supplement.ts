import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const YEARS:Record<string,number>={'4059ad0f5ae3060bb6ac5ad5':2023,'4ad2dbe340aceeb2dcc5d1cc':2024,'d651b74c2eb38cec51690c20':2022};
export function extractFujiSupplement(input:CachedInput):ProjectEvaluation[]{
 const fy=YEARS[input.sourceId];if(input.municipalityCode!=='22210'||!fy)return [];
 const map=new Map<string,ProjectEvaluation>();
 const summary=input.text.slice(0,input.text.indexOf('\n事務事業評価調書'));
 const pattern=fy===2022?/^([^\n]+?) ([ABCD]) ([^\s\n]+)$/gm:/^([^\n]+?) ([^\s\n]+) [ABCDＡＢＣＤ－ー] ([ABCDＡＢＣＤ－ー]) [→↗↘－ー] \d+$/gm;
 for(const m of summary.matchAll(pattern)){
  const name=m[1];if(name.includes('ほか')||!name.includes('事業'))continue;
  const p=project(input,name,name,null,m[0],m.index);p.evaluatedFiscalYear=fy;p.department=fy===2022?m[3]:m[2];
  p.ratings.push({kind:'self',label:`令和${fy-2018}年度評価`,value:(fy===2022?m[2]:m[3]).normalize('NFKC'),scale:null,evidence:evidence(input,m[0],m.index)});map.set(name,p);
 }
 const starts=[...input.text.matchAll(/^事務事業名[①②③④⑤]? (.+?) 担当課 ([^\n]+)$/gm)];
 for(let i=0;i<starts.length;i++){
  const m=starts[i],start=m.index!,end=starts[i+1]?.index??input.text.length;
  if(input.truncated&&i===starts.length-1)continue;
  let raw=input.text.slice(start,end);const next=raw.indexOf('\n事務事業評価調書');if(next>=0)raw=raw.slice(0,next);
  if(!raw.includes('評価指標')||!raw.includes('評価'))continue;
  const name=m[1];if(name.includes('ほか'))continue;
  let p=map.get(name);if(!p){p=project(input,name,name,null,raw,start);p.evaluatedFiscalYear=fy;p.department=m[2];map.set(name,p);}else p.evidence.push(evidence(input,raw,start));
  if(fy>=2023){
   const table=raw.match(/年度 R4年度 R5年度 R6年度 R7年度 R8年度\n予算額 ([\d, ]+)\n実績額 ([\d, ]+)\n/);
   if(table&&raw.includes('（千円）')){const budgets=table[1].trim().split(/ +/),actuals=table[2].trim().split(/ +/);const j=fy-2022;
    // Require every intervening fiscal-year column, preventing blank-cell shifts.
    if(budgets.length===j+2&&actuals.length===j+1){for(const [kind,values] of [['budget',budgets],['actual',actuals]] as const)p.amounts.push({kind,fiscalYear:fy,rawValue:values[j],rawUnit:'千円',amountYen:Number(values[j].replaceAll(',',''))*1000,evidence:evidence(input,table[0],start+table.index!)});}
   }
  }
  if(p.ratings.length===0){const r=raw.match(fy===2022?/評価 ([ABCD]) コメント/:/評価結果 ([ABCDＡＢＣＤ－ー ]+)\n/);if(r){const v=fy===2022?r[1]:r[1].trim().split(/ +/)[fy-2022];if(v)p.ratings.push({kind:'self',label:`令和${fy-2018}年度評価`,value:v.normalize('NFKC'),scale:null,evidence:evidence(input,r[0],start+r.index!)});}}
 }
 for(const p of map.values()){p.evidence.push(evidence(input,input.text.slice(0,Math.min(1000,input.text.length)),0));p.warnings.push('年度は当該事業の評価対象年度。翌年の公表年月から評価年度を推測しない。集計表と個票の同一事業を統合し、複数事業を表す「ほか」は除外。成果指標の折返し・空欄は未変換。');}
 return [...map.values()];
}
