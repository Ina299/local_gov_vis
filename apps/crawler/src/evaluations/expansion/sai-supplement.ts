import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractSaiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='02426'||input.sourceId!=='b4a1949692f9aa08f6d91cde'||input.format!=='pdf')return [];
 const heads=[...input.text.matchAll(/^(?:[①-⑳]|（[^）]+）) *([^\n]+)\n(?=概 要)/gm)];
 const out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  const h=heads[i];if(!h[1].endsWith('事業')||h[1]==='助成事業'||input.truncated&&i===heads.length-1)continue;
  let raw=input.text.slice(h.index,heads[i+1]?.index??input.text.length);const end=raw.search(/\n(?:■|資料)/);if(end>=0)raw=raw.slice(0,end);
  const result=raw.match(/【成果と(?:評価|課題)】\n([\s\S]+?)\n【課題(?:等)?】/);if(!result)continue;
  const p=project(input,h[1],h[1],2024,raw,h.index);p.evaluatedFiscalYear=2023;p.outcomes=result[1].trim();
  p.evidence.push(evidence(input,result[0],h.index+result.index!));
  for(const m of raw.matchAll(/【(予算額|決算額)】 *([\d,]+) *千円/g))p.amounts.push({kind:m[1]==='予算額'?'budget':'actual',fiscalYear:2023,amountYen:Number(m[2].replaceAll(',',''))*1000,rawValue:m[2],rawUnit:'千円',evidence:evidence(input,m[0],h.index+m.index!)});
  p.warnings.push('教育点検報告の事業名・成果と評価・明示された予算決算を部分構造化。計画と実績が横並びの活動表は分離せず、上位施策・委員会部会・施設別小項目は数えていません。');out.push(p);
 }
 return out;
}
