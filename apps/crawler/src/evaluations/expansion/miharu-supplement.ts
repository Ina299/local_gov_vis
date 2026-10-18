import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractMiharuSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='07521'||input.sourceId!=='c16dd8c5214a3a513d2167a2'||input.format!=='pdf')return [];
 const heads=[...input.text.matchAll(/^(?:[０-９]+ *|（[０-９]+）)([^\n]+)\n/gm)];const out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  const h=heads[i];if(!h[1].endsWith('事業')||h[1]==='委員会等に関する事業'||input.truncated&&i===heads.length-1)continue;
  let raw=input.text.slice(h.index,heads[i+1]?.index??input.text.length);const end=raw.search(/\n[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/);if(end>=0)raw=raw.slice(0,end);
  if(!raw.includes('評価')&&!raw.includes('期待'))continue;
  const p=project(input,h[1],h[1],2026,raw,h.index);p.evaluatedFiscalYear=2024;
  p.ratings.push({kind:'external',label:'教育事務点検の事業別意見',value:raw.slice(h[0].length).trim(),scale:null,evidence:evidence(input,raw,h.index)});
  p.warnings.push('教育事務点検報告の事業別意見を部分構造化。学校教育等の上位施策・複数事業を列挙する包括項目は除外。費用・数値指標・独立した評点は未抽出。');out.push(p);
 }
 return out;
}
