import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractMinami(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='36387'||input.sourceId!=='9de68dc3f1561c15e6d850ed')return [];
 const sections=[...input.text.matchAll(/^（([０-９]+)）(.+?)（決算額[ 　]*([０-９，]+)円）/gm)],out:ProjectEvaluation[]=[];
 sections.forEach((s,i)=>{let raw=input.text.slice(s.index,sections[i+1]?.index??input.text.length);if(input.truncated&&i===sections.length-1)return;
  const e=raw.indexOf('\n◇');if(e>=0)raw=raw.slice(0,e);
  const children=[...raw.matchAll(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])([^\n]+)$/gm)];
  const items=children.length?children.map((m,j)=>({name:`${s[2]}／${m[2]}`,code:`${s[1]}:${m[1]}`,raw:raw.slice(m.index,children[j+1]?.index??raw.length),start:s.index!+m.index!})): [{name:s[2],code:s[1],raw,start:s.index!}];
  for(const item of items){if(!item.raw.includes('◎点検・評価')||/／(?:総合体育館利用状況（年間）|活動内容等|施設利用状況|活動状況)$/.test(item.name))continue;
   const p=project(input,item.code,item.name,2023,item.raw,item.start);p.evaluatedFiscalYear=2022;p.evidence.push(evidence(input,input.text.slice(0,300),0));
   if(children.length)p.evidence.push(evidence(input,s[0],s.index));
   const assessment=item.raw.match(/◎点検・評価(?:等)?\n([\s\S]*?)(?=\n◎今後|$)/);if(assessment)p.outcomes=assessment[1].trim();
   if(!children.length)p.amounts.push({kind:'actual',fiscalYear:2022,rawValue:s[3],rawUnit:'円',amountYen:Number(s[3].normalize('NFKC').replaceAll(',','')),evidence:evidence(input,s[0],s.index)});
   p.warnings.push(children.length?'費目内の番号付き具体的事務を部分抽出。費目全体の決算額・外部評価は各子事業へ配賦しません。':'番号付き子事業を持たない独立費目のみ、明記された決算額を抽出。');out.push(p);
  }
 });return out;
}
