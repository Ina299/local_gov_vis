import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
/** Complete individual post-evaluations. Flattened numeric columns remain unassigned. */
export function extractShinjo(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='06205'||input.sourceId!=='9da444128dce380c6f9f5c06')return [];
 const starts=[...input.text.matchAll(/^令和6年度事務事業評価シート（事後評価）/gm)].map(m=>m.index!);
 const records=new Map<string,ProjectEvaluation>();
 for(let i=0;i<starts.length;i++){
  if(input.truncated&&i===starts.length-1)continue;
  const start=starts[i],raw=input.text.slice(start,starts[i+1]??input.text.length);
  const identity=raw.match(/^事務事業名 (.+) 事業コード ([^\n]+)$/m);
  if(!identity||!raw.includes('５．評価指標'))continue;
  const item=project(input,`${identity[2]}:${identity[1]}`,identity[1],null,raw,start);
  item.projectCode=identity[2]; item.evaluatedFiscalYear=2024;
  item.department=raw.match(/担当部署 ([^\n]+)/)?.[1]??null;
  const result=raw.match(/^事業の結果 ?([\s\S]*?)\n３．事業費/m);
  if(result&&result[1].trim()){item.outcomes=result[1].trim();item.evidence.push(evidence(input,result[0],start+result.index!));}
  const indicators=raw.slice(raw.indexOf('５．評価指標'));
  // Require an unwrapped label bounded by the explicit actual-value and achievement rows.
  for(const m of indicators.matchAll(/^実績 [^\n]*\n(活動指標|成果指標) ([^\n]+)\n達成率[^\n]*/gm)){
   item.indicators.push({name:`【${m[1]}】${m[2]}`,fiscalYear:null,target:null,actual:null,unit:null,evidence:evidence(input,m[0],start+raw.indexOf('５．評価指標')+m.index!)});
  }
  item.warnings.push('令和6年度事後評価票の対象年度を2024と保持し、評価を実施した年度は未確定。事業費の予算/決算区分と、指標の空欄年度位置を推測せず数値化しません。');
  const key=identity[2]+':'+identity[1],prior=records.get(key);
  if(prior){prior.evidence.push(...item.evidence);prior.indicators.push(...item.indicators);prior.outcomes=[prior.outcomes,item.outcomes].filter(Boolean).join('\n\n')||null;prior.warnings.push('同一事業コード・名称の対象別の複数票を1事業に統合。費用や成果値を合算していません。');}
  else records.set(key,item);
 }
 return [...records.values()];
}
