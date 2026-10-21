import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractTagami(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='15361'||input.sourceId!=='182a077a731b5380c490a824')return [];
 const starts=[...input.text.matchAll(/^（([０-９0-9]+)） (.+?) 評価： ?([ｓａｂｃｄsabcd－ー])（([^\n]+)）$/gm)];
 const all=starts.flatMap((m,i)=>{if(input.truncated&&i===starts.length-1)return [];let raw=input.text.slice(m.index,starts[i+1]?.index??input.text.length);
  const next=raw.search(/\n[１２３４５６７８９0-9]+[．.]|\n[①②③④⑤⑥⑦⑧⑨] /);if(next>=0)raw=raw.slice(0,next);
  if(!raw.includes('【事業の概要】')||!raw.includes('【成 果】'))return [];
  const p=project(input,`${i+1}:${m[1]}`,m[2],null,raw,m.index);p.evaluatedFiscalYear=2023;p.evidence.push(evidence(input,input.text.slice(0,300),0));
  p.purpose=raw.split('【事業の概要】')[1]?.split('【成 果】')[0].trim()??null;p.outcomes=raw.split('【成 果】')[1]?.split('【課題・意見】')[0].trim()??null;
  p.ratings.push({kind:'self',label:'当該年度の評価',value:m[3].normalize('NFKC'),scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('括弧内評価は当該年度の評価に混在させず、数値成果は文章のまま保持。');return [p];});
 const map=new Map<string,ProjectEvaluation>();for(const p of all){const prev=map.get(p.projectName);if(prev){if(prev.purpose!==p.purpose||prev.outcomes!==p.outcomes||prev.ratings[0].value!==p.ratings[0].value)throw new Error('Tagami repeated name differs');prev.evidence.push(...p.evidence);prev.warnings.push('同一事業の再掲は根拠を統合して1件に集約。');}else map.set(p.projectName,p);}return [...map.values()];
}
