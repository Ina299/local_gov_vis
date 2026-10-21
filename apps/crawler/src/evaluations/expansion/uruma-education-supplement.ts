import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractUrumaEducationSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=input.sourceId==='5c47e2675549a41ce4c6564b'?2024:input.sourceId==='b8fbb9bfab5d7045fdc0ba54'?2025:null;
 if(input.municipalityCode!=='47213'||!year||input.format!=='pdf'||input.truncated)return[];
 const result:ProjectEvaluation[]=[];
 const heads=[...input.text.matchAll(year===2024?/^事業名称 (.+)$/gm:/^基本施策\d+ .+$/gm)];
 for(let i=0;i<heads.length;i++){
  const start=heads[i].index!,end=heads[i+1]?.index??input.text.length;
  let raw=input.text.slice(start,end);
  if(year===2025){const appendix=raw.indexOf('\nうるま市事務点検・評価報告書に対する意見');if(appendix>=0)raw=raw.slice(0,appendix);}
  const name=year===2024?heads[i][1]:raw.match(/^事業や取組み (.+)\n担当課 /m)?.[1];
  const dep=year===2024?raw.match(/^担 当 部 (.+) 課 名 (.+)$/m):raw.match(/^担当課 (.+)$/m);
  const marker=year===2024?'（２）評 価':'内部\n振返りと評価について\n評価';
  const at=raw.indexOf(marker);if(!name||!dep||at<0)continue;
  const p=project(input,`education-${year}-${i+1}`,name,year,raw,start);p.department=year===2024?dep[1]+' '+dep[2]:dep[1];p.evaluatedFiscalYear=year-1;
  p.evidence.push(evidence(input,input.text.slice(0,input.text.indexOf('\n',input.text.indexOf('\n')+1)),0));
  let evaluation=raw.slice(at+marker.length).trim();
  if(year===2024)evaluation=evaluation.split('\n活 指 標 名')[0].trim();
  p.outcomes=evaluation;
  p.warnings.push('教育委員会事務点検・評価の独立事業別記載を部分構造化。成果欄には原文の振返り・評価記述を保持。内部・外部評価の横並び列、経費内訳、活動指標と成果指標の数値は推測で分離していません。');
  result.push(p);
 }
 return result;
}
