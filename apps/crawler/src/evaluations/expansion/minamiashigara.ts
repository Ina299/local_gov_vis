import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractMinamiashigara(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='14217'||input.format!=='pdf'||input.truncated)return [];
 const t=input.text;const starts=[...t.matchAll(/^デジタル田園都市国家構想交付金（地方創生関係交付金）事業 行政評価（令和５年度(?:事業実績|実績及び総括)）/gm)];const result:ProjectEvaluation[]=[];const seen=new Set<string>();
 for(let i=0;i<starts.length;i++){
  const start=starts[i].index!;const b=t.slice(start,starts[i+1]?.index??t.length);const name=b.match(/^事業の名称 (\S+)/m)?.[1];if(!name||!b.includes('重要業績評価指標（ＫＰＩ）の状況'))continue;
  const rating=b.match(/(?:総括評価|評価) ([◎〇]（[^）]+）)/);if(!rating)continue;
  if(seen.has(name))throw new Error(`Duplicate Minamiashigara project: ${name}`);seen.add(name);
  const item=project(input,`name:${name}`,name,null,b,start);item.evaluatedFiscalYear=2023;
  item.ratings.push({kind:'self',label:'事業評価',value:rating[1],scale:null,evidence:evidence(input,rating[0],start+rating.index!)});
  item.warnings.push('交付金の独立事業別評価節を部分構造化。総合戦略や重点プロジェクトの一覧は対象外。複数自治体の合算KPIと本市の実績を混同せず数値未転記。複数年度事業費は空欄位置や費用区分が不明瞭なため原文保持に留めています。');result.push(item);
 }
 return result;
}
