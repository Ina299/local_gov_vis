import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project} from './shared';
const years:Record<string,number>={'17b9ab9bcd52af6de179e1e2':2025,'d23c00cd3bb2aed6ea16812e':2024};
const names=new Set(['南工場の建替え及び運営','新中央市場の整備','中央公園ファミリープールの再整備','中央公園ファミリープールエリアの再整備','平和大通りの利活用の推進']);
export function extractHiroshimaReformProjects(input:CachedInput):ProjectEvaluation[]{
 const year=years[input.sourceId];if(input.municipalityCode!=='34100'||!year)return [];
 const hs=[...input.text.matchAll(/^取組項目 [①-㉟] (.+)$/gm)],rows:ProjectEvaluation[]=[];
 for(let i=0;i<hs.length;i++){
  const h=hs[i];if(!names.has(h[1]))continue;
  let raw=input.text.slice(h.index!,hs[i+1]?.index??input.text.length);const boundary=raw.indexOf('＜参考＞');if(boundary>=0)raw=raw.slice(0,boundary);
  const outcome=raw.match(/＜令和[６７]年度の実施状況＞\n([\s\S]+)/);if(!outcome)continue;
  const r=project(input,h[1],h[1],null,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=year;r.department=raw.match(/^所管(?:課|部局) (.+)$/m)?.[1]??null;r.outcomes=outcome[1].trim();
  r.warnings.push('行政経営改革の実施状況報告中、具体的な施設整備・利活用事業の独立節のみ部分抽出。施策全体や収納率改善等の改革取組全体を事務事業数へ換算しない。実施年度を対象年度として保持し、評価年・評点・費用は未確定。予定と実績が横並びのため原文を保持。');rows.push(r);
 }
 return rows;
}
