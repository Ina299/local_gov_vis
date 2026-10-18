import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const documents=new Set(['0437e4f6cf934dd01b44a942','c3f2597bc26ab3e6e821a8fe','787f9d1b5361e71cf1613d40']);
/** Business-level indicator sections, excluding the separate policy KPI tables. */
function extractDocument(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='34211'||input.format!=='pdf'||!documents.has(input.sourceId))return [];
 const heading='指 標 基準値（H26） H27 H28 H29 H30 R1 R2';
 const heads=[...input.text.matchAll(/^[（(]([０-９0-9]+)[）)]([^\n]+)\n(?=指 標 基準値（H26） H27 H28 H29 H30 R1 R2)/gm)];
 const result=new Map<string,ProjectEvaluation>();
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const h=heads[i];let raw=input.text.slice(h.index,heads[i+1]?.index??input.text.length);
  const end=raw.search(/\n(?:基本目標|目標[０-９0-9]|施策[０-９0-9])/);if(end>=0)raw=raw.slice(0,end);
  if(!raw.includes('実績値')||!raw.includes('目標値'))continue;
  const name=h[2].trim().replace(/（(?:つづき|再掲)）$/,'');
  if(name.includes(' ・'))continue;
  const previous=result.get(name);
  if(previous){previous.evidence.push(evidence(input,raw,h.index));if(!h[2].includes('再掲'))previous.outcomes+=`\n${raw}`;continue;}
  const p=project(input,name,name,null,raw,h.index);p.outcomes=raw.slice(h[0].length).trim();
  p.warnings.push('事業別の指標達成状況を部分構造化。独立した費用・部署・総合評点を持つ個票ではありません。H26～R2の目標・実績表は原文のまま保存し、折返し・空欄により列位置が不確かな数値は分離していません。表頭の最終年度のみでは対象年度を確定できないため、評価対象年度・評価実施年度とも未確定。再掲・続きは同一資料内で統合。');
  result.set(name,p);
 }
 return [...result.values()];
}

export function extractOtakeSupplement(input:CachedInput,inputs:CachedInput[]=[input]):ProjectEvaluation[]{
 const all=inputs.filter(x=>x.municipalityCode==='34211'&&documents.has(x.sourceId)).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 if(!all.length||input.sourceId!==all[0].sourceId)return [];
 const merged=new Map<string,ProjectEvaluation>();
 for(const source of all)for(const p of extractDocument(source)){
  const prior=merged.get(p.projectName);
  if(prior){prior.evidence.push(...p.evidence);prior.outcomes+='\n'+p.outcomes;prior.warnings.push('同名事業の別施策への再掲を資料間で統合。個別指標の原文と全出典を保持しています。');}
  else merged.set(p.projectName,p);
 }
 return [...merged.values()];
}
