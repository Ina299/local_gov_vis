import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractNarita(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='12211'||input.sourceId!=='145f1cb5d278de6ca3ae42fb')return [];
 const rows:ProjectEvaluation[]=[];
 for(const h of input.text.matchAll(/^\d{6} (?:.*? )?(\d{4}) (.+)$/gm)){
  const fields=h[2].split(' ');const values:string[]=[];
  while(fields.length&&/^(維持継続|拡大|縮小|休止|廃止|事業統合|終了|改善・見直し)$/.test(fields.at(-1)!))values.unshift(fields.pop()!);
  if(values.length<2)continue;
  const department=fields.pop()!;let name=fields.join(' '),raw=h[0],start=h.index!;
  if(!name){const prevStart=input.text.lastIndexOf('\n',start-2)+1;const end=input.text.indexOf('\n',start+h[0].length+1);raw=input.text.slice(prevStart,end<0?input.text.length:end);name=raw.split('\n')[0]+raw.split('\n')[2];start=prevStart;}
  const r=project(input,h[1],name,2025,raw,start);r.evaluatedFiscalYear=2024;r.department=department;
  r.ratings.push({kind:'self',label:'評価結果（評価段階終了後）',value:values.at(-1)!,scale:null,evidence:evidence(input,h[0],h.index!)});
  r.warnings.push('事務事業評価一覧の絶対コード・名称・課名と右端の評価結果を収録。途中段階の空欄は詰めず1次～最終各段階への対応は推測しない。個票の費用・成果本文は別資料。');if(['2034','1893','0635','2249'].includes(h[1]))r.warnings.push('同名の別絶対コードがあるが、公式一覧の独立した評価行として保持。年度別評価単位であり、事業実体の独立数を意味しない。');rows.push(r);
 }
 return rows;
}
