import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractYazu(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='31329'||input.format!=='pdf'||!input.text.startsWith('事務事業計画書兼評価表（A表）'))return [];
 const starts=[...input.text.matchAll(/^事務事業計画書兼評価表（A表）$/gm)];const rows:ProjectEvaluation[]=[];
 for(let i=0;i<starts.length;i++){
  if(i===starts.length-1&&input.truncated)continue;
  const start=starts[i].index!;const block=input.text.slice(start,starts[i+1]?.index??input.text.length);
  const identity=block.match(/^事業番号 (\d+) 事 業 名 (.+)$/m);const year=block.match(/基本情報 令和 ([78]) 年度/);
  if(!identity||!year||!block.includes('４ コスト')||!block.includes('一般財源'))continue;
  const evaluationYear=2018+Number(year[1]);const p=project(input,identity[1],identity[2],evaluationYear,block,start);
  const dept=block.match(/^担当課 (.+?) 担当係/m);p.department=dept?.[1]??null;
  for(const [field,begin,end] of [['purpose','事業の目的 ','事業の規模や業務量'],['activities','事業の内容・ ','どんな成果を得たいのか']] as const){
   const a=block.indexOf(begin),b=block.indexOf(end,a);if(a>=0&&b>a){p[field]=block.slice(a,b).trim();p.evidence.push(evidence(input,p[field]!,start+a));}
  }
  const narrative=block.indexOf('３ 取組状況');if(narrative>=0){p.activities=block.slice(narrative,block.indexOf('４ コスト',narrative)).trim();p.evidence.push(evidence(input,p.activities,start+narrative));}
  // Seven displayed columns are required. A five-value line has missing cells and is never shifted into place.
  const costStart=block.indexOf('４ コスト');const cost=block.slice(costStart);const expected=`R${Number(year[1])-3}年度 R${Number(year[1])-2}年度 R${Number(year[1])-1}年度 R${year[1]}年度 R${Number(year[1])+1}年度`;
  if(cost.includes(expected)&&cost.includes('単位 実績 実績 目標 実績 目標 実績 目標')){
   for(const [label,kind] of [['トータルコスト','fullCost'],['職員人件費','personnel'],['事業費','actual']] as const){
    const line=cost.match(new RegExp(`^${label} 千円 ([0-9,]+(?: [0-9,]+){6})$`,'m'));if(!line)continue;
    const vs=line[1].split(' ');for(let col=0;col<2;col++)p.amounts.push({kind,fiscalYear:evaluationYear-3+col,amountYen:Number(vs[col].replace(/,/g,''))*1000,rawValue:vs[col],rawUnit:'千円',evidence:evidence(input,cost,start+costStart)});
   }
  }
  p.warnings.push('A表は計画と過年度実績を併記。表題年度を評価表年度とし、単一の評価対象年度は未設定。7列が揃う費用行の先頭2つの過年度実績だけ転記し、目標列・当年度実績欄の0・空欄は転記しません。「事業の成果・到達点」は期待する成果であり、実績outcomesとして扱いません。数値指標の空列位置は未確定のため保留。同一事業の過年度実績が別の表年度にも再掲されるため、表年度をまたぐ単純合算はできません。');rows.push(p);
 }
 return rows;
}
