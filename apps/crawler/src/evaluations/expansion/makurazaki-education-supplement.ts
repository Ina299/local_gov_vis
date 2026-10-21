import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
export function extractMakurazakiEducationSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=input.sourceId==='3c815eb61f9f6412bf69790c'?2024:input.sourceId==='ff4c5bea58fc21f3a20bb67e'?2025:null;
 if(input.municipalityCode!=='46204'||!year||input.format!=='pdf'||input.truncated)return[];
 const table=[...input.text.matchAll(/^[①②③] 「 ([^\n]+?)」 ([^\n]+)$/gm)].filter(m=>m[2].replace(/ /g,'')==='妥当妥当妥当');
 const heads=[...input.text.matchAll(/^№([123])\nⅢ 外部評価委員の意見及び提言/gm)];
 if(table.length!==3||heads.length!==3)return[];
 return heads.map((h,i)=>{const start=h.index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length),name=table[i][1].replace(/ /g,'');
  const p=project(input,`education-${year}-${h[1]}`,name,year,raw,start);p.evidence.push(evidence(input,table[i][0],table[i].index!));p.evidence.push(evidence(input,input.text.split('\n')[0],0));
  for(const label of['妥当性','効率性','有効性'])p.ratings.push({kind:'self',label,value:'妥当',scale:null,evidence:evidence(input,table[i][0],table[i].index!)});
  p.warnings.push('教育委員会事務点検の独立3事業を抽出。外部意見と事務局回答の横並び文は全原文根拠で保持し話者別に推測分割しない。表題の評価年度を保持し、対象実績年度・金額・指標数値は未確定。');return p;});
}
