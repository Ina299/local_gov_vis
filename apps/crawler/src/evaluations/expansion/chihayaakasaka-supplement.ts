import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** Published HTML result table: explicit row IDs and all four rating cells required. */
export function extractChihayaakasakaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='27383'||input.format!=='html'||input.sourceId!=='0edbecb3fa7a7b3224ed8422')return [];
 const fiscal='（評価対象年度：平成25年度事務事業）';const schema='第1次評価\n自己評価\n第2次評価\n政策評価\n外部評価\n第3次評価\n総合評価';
 if(!input.text.includes(fiscal)||!input.text.includes(schema)||!input.text.includes('平成26年度 事務事業評価'))return [];
 const result:ProjectEvaluation[]=[];const codes=new Set<string>();
 for(const m of input.text.matchAll(/^(\d+)\n(\d{8})\n([^\n]+)\n([^\n]+)\(PDF:[\d.]+KB\)\n([A-D-])\n([A-D-])\n([A-D-])\n([A-D-])(?=\n|$)/gm)){
  if(codes.has(m[2]))throw new Error(`Duplicate Chihayaakasaka code ${m[2]}`);codes.add(m[2]);
  const p=project(input,m[2],m[4],2014,m[0],m.index!);p.department=m[3];p.evaluatedFiscalYear=2013;p.evidence.push(evidence(input,fiscal),evidence(input,schema));
  const labels=['第1次評価・自己評価','第2次評価・政策評価','外部評価','第3次評価・総合評価'];
  for(let i=0;i<4;i++)if(m[5+i]!=='-')p.ratings.push({kind:i===2?'external':'self',label:labels[i],value:m[5+i],scale:null,evidence:evidence(input,m[0],m.index!)});
  p.warnings.push('平成26年度の公開結果一覧（対象平成25年度）。A～Dの意味は保存本文に明記なしのため補わない。外部評価の「-」を実施済み判定に変換しない。費用・実績指標は別添個票未取得のため未設定。');result.push(p);
 }
 return result;
}
