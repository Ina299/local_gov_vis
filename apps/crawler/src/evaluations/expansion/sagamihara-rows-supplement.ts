import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
/** PPP evaluation overview: eight actual project decisions, with year sourced from its publication page. */
export function extractSagamiharaRowsSupplement(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{
 if(input.municipalityCode!=='14150'||input.sourceId!=='d1b7234ef1434f3b6aa14479'||input.truncated)return[];
 const cover=inputs.find(d=>d.sourceId==='cc4fbb89a3f466b58b194222'&&d.text.includes('平成27年度事務事業評価の結果'));
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^([１-８]) (.+?) (現状を継続|見直し) (現状を継続|見直し)$/gm)){
  const p=project(input,m[1].normalize('NFKC'),m[2],cover?2015:null,m[0],m.index);
  p.ratings=[{kind:'self',label:'１次評価',value:m[3],scale:null,evidence:evidence(input,m[0],m.index)},{kind:'external',label:'２次評価（経営評価委員会）',value:m[4],scale:null,evidence:evidence(input,m[0],m.index)}];
  if(cover)p.evidence.push(evidence(cover,'平成27年度事務事業評価の結果',cover.text.indexOf('平成27年度事務事業評価の結果')));
  p.warnings.push('概要表の事業別評価行のみ部分収録。掲載案内本文がある場合のみ評価年度を確定し、対象実績年度は推定しない。費用・成果指標・所管課はこの表に掲載されていない。');out.push(p);
 }
 return out;
}
