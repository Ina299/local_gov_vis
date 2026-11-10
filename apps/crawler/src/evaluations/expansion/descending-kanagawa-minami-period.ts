import{createHash}from'node:crypto';
import{config}from'./descending-kanagawa-minami-period-map';
import{project,evidence,type CachedInput}from'./shared';
export{config};
export function reviewMinamiPeriod(i:CachedInput){
 const c=config;if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Named completed work in the explicit FY2015–2019 period; no inferred individual execution year.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(i.text.slice(c.evaluationOffset,c.evaluationOffset+c.evaluationQuote.length)!==c.evaluationQuote)throw Error('Historical report date mismatch');
 for(const row of c.rows){
  if(!row.period||!row.period.includes("2015")||!row.period.includes("2020")||!row.endQuote.includes("2019"))throw Error("Historical period proof absent");
  for(const [start,raw] of [[row.start,row.raw],[row.activityOffset,row.activities],[row.periodOffset,row.period],[row.endOffset,row.endQuote]]as const)if(i.text.slice(start,start+raw.length)!==raw)throw Error('Historical programme quote mismatch');
  if(row.raw!==row.name)throw Error('Historical programme name mismatch');
  const p=project(i,'period-programme-'+row.start,row.name,c.evaluationYear,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;p.activities=row.activities;
  p.evidence.push(evidence(i,c.evaluationQuote,c.evaluationOffset),evidence(i,row.activities,row.activityOffset),evidence(i,row.period,row.periodOffset),evidence(i,row.endQuote,row.endOffset));
  p.warnings.push('平成27年度〜令和元年度の期間終了時点の総括で明示された個別事業。評価年2020、単一の実施年度は未確定のためnull。期間の各年度に複製せず、後続年度の同名事業と期間を区別。金額・件数・政策単位の達成率は割り当てない。');
  r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit completed programme name and bounded historical period; no single fiscal year inferred.'});
 }
 r.status='reviewed_explicit_historical_programme_events';return r;
}
