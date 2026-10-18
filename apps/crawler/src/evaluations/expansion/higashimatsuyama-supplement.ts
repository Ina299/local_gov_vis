import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractHigashimatsuyamaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11212'||input.sourceId!=='e0ca82deec4a2f47956c2a94')return [];
 const hs=[...input.text.matchAll(/^事業名 （[^）]+）([^\n]+?) (?:―|戦略 [\d-]+) 担当課 ([^\n]+)$/gm)],out:ProjectEvaluation[]=[];
 const seen=new Set<string>();
 for(let i=0;i<hs.length;i++){
  const m=hs[i],next=hs[i+1]?.index??input.text.length;let raw=input.text.slice(m.index,next);
  const end=raw.indexOf('予算額 ');if(end<0||!raw.includes('（実績）'))continue;
  raw=raw.slice(0,end);const key=m[1]+'|'+m[2];if(seen.has(key))continue;seen.add(key);
  const p=project(input,key,m[1],null,raw,m.index);p.department=m[2];const start=raw.indexOf('方向性 現状値');const finish=raw.indexOf('令和8年度',start);
  if(start<0||finish<0)continue;p.outcomes=raw.slice(start,finish).trim();p.evidence.push(evidence(input,input.text.slice(-120)));
  p.warnings.push('令和8〜10年度実施計画の事業別現状値（実績）を原文で保持。計画年度は実績年度・評価年度を意味しないため両年度は未設定。未来目標値を実績として数値化せず、予算額・計画額は抽出対象外。');out.push(p);
 }
 return out;
}
