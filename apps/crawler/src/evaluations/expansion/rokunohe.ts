import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';
export function extractRokunohe(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='02405'||input.sourceId!=='1125988243068b731e00f1c0')return [];
 const hs=[...input.text.matchAll(/^([^\n]+)\n◇概 要$/gm)];
 return hs.flatMap((h,i)=>{
  // School activity units are distinct; the intermediate social education/sports headings group many programs.
  if(i>=29&&i<hs.length-3)return [];
  let raw=input.text.slice(h.index!,hs[i+1]?.index??input.text.length);
  const boundary=raw.search(/\n(?:（3）六戸町立|資 料\n)/);if(boundary>=0)raw=raw.slice(0,boundary);raw=raw.trimEnd();
  if(!raw.includes('◇実 績')||!raw.includes('◇課題等'))return [];
  const name=h[1].slice(1),r=project(input,name,name,2021,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=2020;
  r.purpose=raw.slice(raw.indexOf('◇概 要')+5,raw.indexOf('◇計 画')).trim();
  const end=raw.includes('◇成 果')?raw.indexOf('◇成 果'):raw.indexOf('◇課題等');
  r.activities=raw.slice(raw.indexOf('◇実 績')+5,end).trim();
  r.outcomes=raw.slice(end).trim();
  r.warnings.push('学校教育の事業別点検節及び学校環境整備3事業。中間の社会教育・図書館・スポーツの複数事業を束ねた施策見出しは収録せず、費用・評点の推定もしない。');return [r];
 });
}
