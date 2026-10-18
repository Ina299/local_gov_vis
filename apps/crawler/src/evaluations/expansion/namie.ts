import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractNamie(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='07547'||input.sourceId!=='9558e3150cc1eeb1c6582162')return [];
  const starts=[...input.text.matchAll(/^◆([^\n]+)\n（([^\n]+)）/gm)];
  return starts.flatMap((m,i)=>{
    const raw=input.text.slice(m.index,starts[i+1]?.index??input.text.length);
    if(input.truncated&&i===starts.length-1)return [];
    const p=project(input,m[1],m[1],null,raw,m.index);p.evaluatedFiscalYear=2024;p.evidence.push(evidence(input,input.text.slice(0,450),0));p.department=m[2];
    const amount=raw.match(/（円） 国県支出金 特定財源 一般財源\n([\d,]+)(?: [\d,]+)+\n/);
    if(amount)p.amounts.push({kind:'actual',fiscalYear:2024,rawValue:amount[1],rawUnit:'円',amountYen:Number(amount[1].replaceAll(',','')),evidence:evidence(input,amount[0],m.index!+amount.index!)});
    if(amount)p.activities=raw.slice(amount.index!+amount[0].length).trim();
    p.warnings.push('教育委員会が点検評価に代えると明示した主要な施策の成果説明書。報告年月を評価年度に変換していません。活動実績を成果指標とみなしていません。');return [p];
  });
}
