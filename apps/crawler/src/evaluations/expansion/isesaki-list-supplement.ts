import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const YEARS:Record<string,number>={'7a87525939b016f27138d561':2021,'141d1b4a903e68eb500b965b':2022,'ab1d23407b2c5179faf33cf5':2023,'8411e6730e0837e8c6ed5c58':2024,'49beae85f3ef6f9b52e3a666':2025};
export function extractIsesakiListSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=YEARS[input.sourceId];if(input.municipalityCode!=='10204'||!year||input.format!=='pdf'||input.truncated)return[];
 const columns=year>=2023?3:2;const ratings='(?:継 ?続|一部改善|大幅な改善|休 ?止|廃 ?止|終 ?了|-)';
 const pattern=new RegExp(`^(\\d+) ${year>=2023?'(\\d+) ':''}(.+?) (\\S+) (${ratings}(?: ${ratings}){${columns-1}})$`,'gm');
 const result:ProjectEvaluation[]=[];
 for(const match of input.text.matchAll(pattern)){
  const shift=year>=2023?1:0,name=match[2+shift],department=match[3+shift],values=[...match[4+shift].matchAll(new RegExp(ratings,'g'))].map(m=>m[0].replace(/ /g,''));
  if(!/(課|館|学校|局|室|所)$/.test(department)||values.every(v=>v==='-'))continue;
  const p=project(input,`list-${year}-${match[1]}`,name,year,match[0],match.index!);p.department=department;
  p.evidence.push(evidence(input,input.text.split('\n')[0],0));
  values.forEach((value,i)=>{if(value!=='-')p.ratings.push({kind:'self',label:['一次評価','二次評価','最終評価'][i],value,scale:null,evidence:evidence(input,match[0],match.index!)});});
  p.warnings.push('対象事業一覧の単行名称・担当課・評価区分のみを部分構造化。長文個票ではありません。名称改行・評価なしの行は除外。評価実施年度と事業対象年度は区別し、事業対象年度・費用・成果数値は推測していません。');result.push(p);
 }
 return result;
}
