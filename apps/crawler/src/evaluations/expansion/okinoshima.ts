import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractOkinoshima(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='32528'||input.sourceId!=='a69309985f3ab992cefbb676')return [];
 const hs=[...input.text.matchAll(/^事 業 名 (.+) 担 当 課$/gm)];
 return hs.flatMap((h,i)=>{
  const raw=input.text.slice(h.index!,hs[i+1]?.index??input.text.length).trimEnd(),opinion=raw.indexOf('方 向 性 意 見・提 言');if(opinion<0)return [];
  const r=project(input,h[1],h[1],2025,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=2024;
  r.activities=raw.slice(raw.indexOf('事 業 目 的 事 業 概 要'),opinion).trim();r.outcomes=raw.slice(opinion+'方 向 性 意 見・提 言'.length).replace(/\n\d+\n令和７年度 事務事業外部評価結果$/,'').trim();
  const direction=raw.slice(opinion).match(/^(現状維持|手法・内容の見直し|拡大|縮小|統合|廃止|完了)(?: |$)/m);
  if(direction)r.ratings.push({kind:'external',label:'事業の方向性',value:direction[1],scale:null,evidence:evidence(input,direction[0],h.index!+opinion+direction.index!)});
  r.warnings.push('外部評価の16評価単位を収録。小中学校を合同で評価した票は分割しない。概要・目的の左右列は一体保持。指標の目標年度が複数形式のため数値列は転記しない。集計欄の件数より個票に印字された方向性を優先して保持。');return [r];
 });
}
