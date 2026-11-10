import{createHash}from'node:crypto';
import{config}from'./descending-kanagawa-minami-historical-programs-map';
import{project,evidence,type CachedInput}from'./shared';
export{config};
export function reviewMinamiHistoricalPrograms(i:CachedInput){
 const c=config;if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Only explicitly dated named implementation/establishment/expansion events in a historical report.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(i.text.slice(c.evaluationOffset,c.evaluationOffset+c.evaluationQuote.length)!==c.evaluationQuote)throw Error('Historical report date mismatch');
 for(const row of c.rows){
  for(const [start,raw] of [[row.start,row.raw],[row.activityOffset,row.activities],[row.contextOffset,row.context]]as const)if(i.text.slice(start,start+raw.length)!==raw)throw Error('Historical programme quote mismatch');
  if(row.raw!==row.name)throw Error('Historical programme name mismatch');
  const p=project(i,'dated-programme-'+row.year+'-'+row.start,row.name,c.evaluationYear,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;p.activities=row.activities;
  p.evidence.push(evidence(i,c.evaluationQuote,c.evaluationOffset),evidence(i,row.activities,row.activityOffset),evidence(i,row.context,row.contextOffset));
  p.warnings.push('過年度総括本文に明示された制度の開設・拡充・調査実施年度のみ。総括対象の各年度へ複製せず、年度が不明な別制度を補わない。制度拡充を助成金支払額と解釈せず、金額・利用者数・評価点は未設定。');
  r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Exact event-specific date and named scheme; other period-wide fields not inferred.'});
 }
 r.status='reviewed_explicit_historical_programme_events';return r;
}
