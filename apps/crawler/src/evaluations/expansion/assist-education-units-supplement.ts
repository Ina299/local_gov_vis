import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
export function extractAssistEducationUnitsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='pdf'||input.truncated)return[];const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='11348'&&input.sourceId==='a51b3b2cc5793ab2ebe7c88c'){
  const heads=[...input.text.matchAll(/^[①-⑳] (.+)【(.+)】$/gm)];
  for(let i=0;i<heads.length;i++){
   const h=heads[i];if(!['「子ども大学」の充実に向けた支援','デジタル図書館の充実'].includes(h[1]))continue;
   const start=h.index!;let raw=input.text.slice(start,heads[i+1]?.index??input.text.length);const next=raw.search(/^\(\d+\) /m);if(next>=0)raw=raw.slice(0,next);
   const p=project(input,`education-2024-${i+1}`,h[1],null,raw,start);p.department=h[2];p.evaluatedFiscalYear=2024;p.outcomes=raw.slice(h[0].length).trim();
   p.evidence.push(evidence(input,'令和 6 年度の教育行政の基本方針として定め'));
   p.warnings.push('教育重点施策報告のうち独立した子ども大学支援・デジタル図書館運営の記述のみ。令和6年度取組を対象とし評価実施年度は本文未確定。原文叙述を保持し金額・成果数値を推測していない。');out.push(p);
  }
 }
 if(input.municipalityCode==='11349'&&input.sourceId==='e2a191018a4449d4b886cb12'){
  const anchor='重点的に取り ・図書館の機能の向上と効率運営の推進',pos=input.text.indexOf(anchor);if(pos<0)return[];
  const marker='ときがわ町教育行政の重点施策評価調書';const start=input.text.lastIndexOf(marker,pos),end=input.text.indexOf(marker,pos),raw=input.text.slice(start,end<0?undefined:end);
  const at=raw.indexOf('施策の評価');if(at<0)return[];
  const p=project(input,'library-operation-2017','図書館の機能の向上と効率運営の推進',null,raw,start);p.department='生涯学習課';p.evaluatedFiscalYear=2017;p.outcomes=raw.slice(at+'施策の評価'.length).trim();p.evidence.push(evidence(input,'平成 29 年度ときがわ町教育行政重点施策'));
  p.warnings.push('教育重点施策評価のうち図書館運営の独立記述のみ。平成29年度取組の評価、実施評価年度未確定。図書館内の複数活動を別事業へ細分せず、費用・数値指標は未抽出。');out.push(p);
 }return out;
}
