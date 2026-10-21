import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';
export function extractImizu(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='16211'||input.sourceId!=='be9bd33d81027745ec21accb')return [];
 const heads=[...input.text.matchAll(/^事業名 (.+?) （ .+? 担当部課(?: (.+))?$/gm)];
 return heads.flatMap((h,i)=>{
  if(input.truncated&&i===heads.length-1)return [];
  const raw=input.text.slice(h.index!,heads[i+1]?.index??input.text.length).trimEnd();
  const start=raw.indexOf('評価と今後の方向性（担当課意見）');if(start<0)return [];
  const r=project(input,`${h[2]}:${h[1]}`,h[1],null,raw,h.index!);r.projectCode=null;r.department=h[2]??null;r.evaluatedFiscalYear=2024;
  r.activities=raw.slice(start).trim();
  r.warnings.push('令和6年度決算成果報告（令和7年8月29日提出）の個別事業節。成果と担当課意見の左右列が混在するため原文一体で保持。事業費表に表示単位の明示を確認できず金額は構造化せず原文保持。末尾の途中切れ事業は除外。');return [r];
 });
}
