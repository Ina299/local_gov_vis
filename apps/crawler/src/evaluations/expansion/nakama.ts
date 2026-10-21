import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';
export function extractNakama(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='40215'||input.sourceId!=='eff710251997de1aff169018')return [];
 const hs=[...input.text.matchAll(/^平成30年度【(事前|事後)】事務事業評価表（業務チェックシート(?:《その１》)?）$/gm)];
 return hs.flatMap((h,i)=>{
  let raw=input.text.slice(h.index!,hs[i+1]?.index??input.text.length);const list=raw.indexOf('平成30年度 事務事業評価結果一覧表');if(list>=0)raw=raw.slice(0,list);raw=raw.trimEnd();
  const name=raw.match(/^③事業名 (.+?) 款/m)?.[1],year=raw.match(/^対象年度 平成(\d+)年度$/m)?.[1];if(!name||!year)return [];
  const r=project(input,name,name,2018,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=1988+Number(year);
  r.department=raw.match(/②課\s*名 (.+?) 課/)?.[1]??null;r.activities=raw;
  r.warnings.push(`${h[1]}評価の個別業務チェックシート。評価選択肢のチェック位置は推測せず原文保持。事前票の計画額を予算額として抽出しない。事後対象は平成29年度、事前対象は平成31年度を原文どおり区別。`);return [r];
 });
}
