import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
/** The project result rows embedded in 2022 policy sheets; policy ratings are excluded. */
export function extractUonumaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='15225'||input.sourceId!=='cc8167f2bb866446322e06a2')return [];
// Same 2021 fiscal-year projects are already represented by the legacy individual sheets (14256.pdf).
 const existing2021=new Set(["39", "65", "67", "57", "60", "45", "34", "42", "185", "36", "47", "139", "172", "194", "195", "196", "142", "169", "173", "104", "116", "129", "127", "130", "120", "124", "189"]);
 const records=new Map<string,ProjectEvaluation>();
 for(const table of input.text.matchAll(/3\.施策を構成する事業の事業費、取組内容及び評価\n([\s\S]*?)(?=4-1\.)/g)){
  const content=table[0];
  const heads=[...content.matchAll(/^([^\n]+)\n([\d, -]+) ((?:やや)?(?:高い|低い)) ([Ａ-Ｄ])$/gm)];
  for(let i=0;i<heads.length;i++){
   const h=heads[i];let start=h.index!,name=h[1];
   if(name.startsWith('（')){const prevEnd=start-1,prevStart=content.lastIndexOf('\n',prevEnd-1)+1;name=content.slice(prevStart,prevEnd)+name;start=prevStart;}
   let end=heads[i+1]?.index??content.length;
   if(heads[i+1]?.[1].startsWith('（'))end=content.lastIndexOf('\n',end-2)+1;
   const raw=content.slice(start,end).trimEnd();
   const tail=raw.slice(raw.indexOf(h[0])+h[0].length).trimStart();
   const code=tail.match(/^(?:[^\n]+\n)?([\d]+|介\d+)\b/m)?.[1];if(!code||existing2021.has(code))continue;
   const department=tail.split('\n')[0].replace(/^\d+\s*○?\s*/, '');
   const r=project(input,`${code}:${name}`,name,2022,raw,table.index!+start);r.projectCode=code;r.department=department;r.evaluatedFiscalYear=2021;
   r.ratings.push({kind:'self',label:'担当課総合評価',value:h[4],scale:null,evidence:evidence(input,h[0],table.index!+h.index!)});
   r.activities=raw;
   r.warnings.push('施策評価票の構成事務事業一覧の評価行のみ。施策全体の成果指標・評点は割り当てない。費用は後年度空欄の列位置を断定せず原文に保持。同一事業の施策間再掲は統合。');
   const prior=records.get(r.id);if(prior){prior.evidence.push(...r.evidence);for(const rating of r.ratings)if(!prior.ratings.some(x=>x.value===rating.value))prior.ratings.push(rating);}else records.set(r.id,r);
  }
 }
 return [...records.values()];
}
