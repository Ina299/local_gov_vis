import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractKurashiki2025(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='33202'||input.sourceId!=='53bb7d3dc207393ef9011e33')return [];
 const sections=[...input.text.matchAll(/^施策を推進する主な事業の評価$/gm)],rows=new Map<string,ProjectEvaluation>();
 for(const section of sections){
  const start=section.index!,next=input.text.indexOf('第七次総合計画 施策評価シート',start+1),end=next<0?input.text.length:next,part=input.text.slice(start,end);
  const hs=[...part.matchAll(/^[^\n]*\(Ⅰ\)/gm)];
  for(let i=0;i<hs.length;i++){
   let raw=part.slice(hs[i].index!,hs[i+1]?.index??part.length);
   if(input.truncated&&next<0&&i===hs.length-1)continue;
   const m=raw.match(/^([^\s、。]{2,55}(?:事業|事業費|支援|運営|管理|推進|整備|助成|補助金|補助)) \(Ⅱ\)/m);
   if(!m||!raw.includes('(Ⅲ)'))continue;
   if(['史博物館まつり事業','本・文献等収集事業','子ども読書活動推進','シティセールス推進','ンタクシー導入支援'].includes(m[1]))continue;
   const tail=raw.search(/\n\d+\nR6年度/);if(tail>=0)raw=raw.slice(0,tail);
   const pos=start+hs[i].index!;
   if(rows.has(m[1])){rows.get(m[1])!.evidence.push(evidence(input,raw,pos));continue;}
   const r=project(input,m[1],m[1],2025,raw,pos);r.projectCode=null;r.evaluatedFiscalYear=2024;r.outcomes=raw;
   r.warnings.push('施策内の「主な事業の評価」のうち名称が一行で確定する事業のみ部分抽出。目的・実績・今後の方向性を混在する原文のまま保持。複数行名称・決算列の対応は推測せず未抽出。同名再掲は証拠を統合。');rows.set(m[1],r);
  }
 }
 return [...rows.values()];
}
