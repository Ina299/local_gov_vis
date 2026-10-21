import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
export function extractYatsushiroCitizenSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='43202'||input.sourceId!=='a13987f1db6f368b6ba4908a'||input.format!=='pdf'||input.truncated)return[];
 const result:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(?:(\S+) )?(\S+(?:課|室|館|局|センター)) (\S*会計) (\d+) (.+?) ([1-9]\d*) (\d+\.\d) (\d+\.\d)(?: (\d+\.\d))?$/gm)){
  const p=project(input,`citizen-2025-${m[4]}`,m[5],2025,m[0],m.index!);p.department=m[2];p.evaluatedFiscalYear=2024;
  p.evidence.push(evidence(input,'令和６年度の「主要な施策の成果に関する調書」'));
  for(const[i,label]of[[7,'必要度（市民回答平均）'],[8,'満足度（市民回答平均）'],[9,'充足度（市民回答平均・表原文）']]as const)if(m[i])p.ratings.push({kind:'external',label,value:m[i],scale:'市民回答の10段階尺度の平均（回答数が少ない場合を含む）',evidence:evidence(input,m[0],m.index!)});
  p.warnings.push(`市民アンケート評価一覧の回答あり事業のみ。回答件数${m[6]}件。行政内部評価・監査結果ではなく任意回答の平均であり、空欄の充足度を補完していない。事業費や成果実績の数値は掲載評価値から生成しない。`);result.push(p);
 }return result;
}
