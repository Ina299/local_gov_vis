import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';import {type CachedInput,evidence,project}from './shared';
export function extractKofuSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='19201'||input.sourceId!=='234531e5f219fa16574b341e'||input.format!=='pdf')return [];
 const heads=[...input.text.matchAll(/^事 業 名 (.+)\n所管課名 (.+)$/gm)];const out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const h=heads[i];let raw=input.text.slice(h.index,heads[i+1]?.index??input.text.length);const end=raw.indexOf('\n５ 委員名簿');if(end>=0)raw=raw.slice(0,end);
  if(!raw.includes('意 見'))continue;
  const p=project(input,h[1],h[1],2019,raw,h.index);p.department=h[2];
  p.ratings.push({kind:'external',label:'外部評価の事業別報告（概要・現状・意見を含む原文）',value:raw,scale:null,evidence:evidence(input,raw,h.index)});
  p.warnings.push('令和元年度外部評価報告の独立した6事業の節を部分構造化。見出しが文章途中に配置されるため概要・現状と委員意見は原文のまま一体保持し、成果や個別評点へ推測分離していません。対象実施年度・費用は未確定。');out.push(p);
 }
 return out;
}
