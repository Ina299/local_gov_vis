import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const YEARS:Record<string,number>={'2c4f917a66c6861e7160cc0a':2020,'f3bf7971b71e9131d0e0dede':2021,'0a9b92fc12a6a1ecdd6c1dba':2022,'b7817674385fb67273af24ec':2023,'b41489d9691306ad7764ba25':2024};
export function extractYasugiSupplement(input:CachedInput):ProjectEvaluation[]{
 const fy=YEARS[input.sourceId];if(input.municipalityCode!=='32206'||!fy)return [];
 const starts=[...input.text.matchAll(/^第２期 安来市まち・ひと・しごと創生総合戦略 事業評価シート/gm)];
 return starts.flatMap((m,i)=>{
  if(input.truncated&&i===starts.length-1)return [];
  const raw=input.text.slice(m.index,starts[i+1]?.index??input.text.length);
  const name=raw.match(/^事業名 (.+?) 内部評価（Check） 外部評価（Check）$/m),dep=raw.match(/^担当課 ([^\n]+)$/m);
  if(!name||!dep||!raw.includes('評価基準'))return [];
  const p=project(input,`${fy}:${name[1]}`,name[1],null,raw,m.index);p.evaluatedFiscalYear=fy;p.evidence.push(evidence(input,input.text.slice(0,300),0));p.department=dep[1];
  const cost=raw.match(/^総事業費（千円） ((?:[\d,]+ ){5}[\d,]+)(?: |$)/m);
  if(cost&&raw.includes('決算額')){const values=cost[1].split(' ');p.amounts.push({kind:'actual',fiscalYear:fy,rawValue:values[fy-2020],rawUnit:'千円',amountYen:Number(values[fy-2020].replaceAll(',',''))*1000,evidence:evidence(input,cost[0],m.index!+cost.index!)});}
  p.warnings.push('総括表に明記された対象年度の個別事業。過年度の評価・改善策が複数列で混在するため評価文字や成果の単年度転記はせず個票本文を保持。総事業費はR2～R7の6列が揃う場合だけ対象年を抽出。原本のR7資料から抽出済みの年度未確定レコードとは同一事業の別報告版であり単純合算不可。');return [p];
 });
}
