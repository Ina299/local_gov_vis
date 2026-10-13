import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const YEARS:Record<string,number>={'5952d6117c1aaa2c8eaafd44':2021,'f0eec45d1958763245b1921f':2023};
/** Council opinions on identified projects, not the executive's full evaluation sheets. */
export function extractKomagane(input:CachedInput):ProjectEvaluation[]{
 const year=YEARS[input.sourceId];
 if(input.municipalityCode!=='20210'||!year||input.format!=='pdf'||input.truncated)return[];
 const headers=[...input.text.matchAll(/^事 業 名 ([０-９]+) ([^\n]+)\n/gm)];
 const results:ProjectEvaluation[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i];const start=h.index!;
  // R5's other subjects are policy bundles or the entire water-service account.
  if(year===2023&&h[2]!=='子ども交流センター運営事業')continue;
  // This section explicitly evaluates two underlying school-management projects together.
  if(year===2021&&h[1]==='７')continue;
  let end=headers[i+1]?.index??input.text.length;
  const appendix=input.text.indexOf('\nⅥ 経過',start);if(appendix>=0&&appendix<end)end=appendix;
  const raw=input.text.slice(start,end);
  if(!/（[１３]）要望・提言/.test(raw))continue;
  const item=project(input,`council-${year}-${h[1].normalize('NFKC')}`,h[2],year,raw,start);
  const assessment=raw.match(/（２）評価\n([\s\S]*?)(?=\n（３）要望・提言)/);
  if(assessment){item.outcomes=`【議会による評価記述】${assessment[1].trim()}`;item.evidence.push(evidence(input,assessment[0],start+assessment.index!));}
  const rating=raw.match(/^総 合 評 価 ([ＡＢＣＤ])：([^\n]+)$/m);
  if(rating)item.ratings.push({kind:'external',label:'議会総合評価',value:rating[1],scale:rating[2],evidence:evidence(input,rating[0],start+rating.index!)});
  const direction=raw.match(/^今後の方向性 ([１-５])：([^\n]+)$/m);
  if(direction)item.ratings.push({kind:'external',label:'議会による今後の方向性',value:direction[1],scale:direction[2],evidence:evidence(input,direction[0],start+direction.index!)});
  item.warnings.push('市議会の事業別評価・提言を部分構造化したもので、執行部の完全評価個票ではありません。対象事業年度は確定せず未設定。文中の金額や数値は個別事業費・成果指標へ推定変換していません。識別コードは文書年度と議会評価の項目番号を結合。');
  results.push(item);
 }
 return results;
}
