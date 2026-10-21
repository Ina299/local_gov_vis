import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';
export function extractShimokawa(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='01468'||input.sourceId!=='a7613ca56e9a7ffb5fa6adc8')return [];
 const stop=input.text.lastIndexOf('\n（４）その他\n'),text=input.text.slice(0,stop<0?input.text.length:stop);
 const heads=[...text.matchAll(/^「([^」]+)」(?:と「([^」]+)」)?では、/gm)];
 return heads.flatMap((h,i)=>{
  const block=text.slice(h.index!,heads[i+1]?.index??text.length);const boundary=block.search(/\n(?:[○〇]施策項目|（[１２３]）)/);const raw=(boundary<0?block:block.slice(0,boundary)).trimEnd();
  return [h[1],h[2]].filter((x):x is string=>Boolean(x)).map(name=>{
   const r=project(input,name,name,2025,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=2024;r.outcomes=raw;
   r.warnings.push('総合計画審議会中間報告中で事業名を明示した個別意見のみ。全35事業の完全収録ではない。評点・金額はなく、対象外事業への一般意見は除外。');
   if(h[2])r.warnings.push('二つの空き家関連事業に共通する意見段落。各事業固有の成果・費用へ分割していません。');return r;
  });
 });
}
