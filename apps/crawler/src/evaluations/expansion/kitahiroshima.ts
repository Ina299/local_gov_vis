import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractKitahiroshima(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='01234'||input.sourceId!=='9134792274da1a5a3ebb4dc8')return [];
 const start=input.text.indexOf('4 評価結果について');if(start<0)return [];
 const text=input.text.slice(start),heads=[...text.matchAll(/^(.+「(要検討|見直し)」とした事業)$/gm)];
 return heads.flatMap((h,i)=>[...text.slice(h.index!+h[0].length,heads[i+1]?.index??text.length).matchAll(/^\((\d+)\) (.+)$/gm)].map(m=>{
  const r=project(input,`${h[2]}:${m[1]}`,m[2],2025,m[0],start+h.index!+h[0].length+m.index!);r.projectCode=null;r.evaluatedFiscalYear=2024;
  r.ratings.push({kind:'self',label:'今後の方向性',value:h[2],scale:null,evidence:evidence(input,h[0],start+h.index!)});
  r.warnings.push('報告書の特徴的な評価結果として名前が明示された7事業のみ。全241事業の収録ではない。');return r;
 }));
}
