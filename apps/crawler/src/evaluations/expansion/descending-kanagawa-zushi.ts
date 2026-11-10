import{createHash}from'node:crypto';
import{configs}from'./descending-kanagawa-zushi-map';
import{project,evidence,type CachedInput}from'./shared';
export{configs};
export function reviewZushi(i:CachedInput){
 const c=configs.find(x=>x.sourceId===i.sourceId&&x.municipalityCode===i.municipalityCode);if(!c)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Only named administrative-reform work units with completed annual implementation narratives.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 for(const row of c.rows){
  const first=row.parts[0];if(i.text.slice(first.start,first.start+first.raw.length)!==first.raw||first.raw!==row.name||i.text.slice(row.yearOffset,row.yearOffset+row.yearQuote.length)!==row.yearQuote||i.text.slice(row.activityOffset,row.activityOffset+row.activities.length)!==row.activities)throw Error('Zushi annual work-unit mismatch');
  const p=project(i,'reform-'+first.start,row.name,null,first.raw,first.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;p.activities=row.activities;
  p.evidence.push(evidence(i,row.yearQuote,row.yearOffset),evidence(i,row.activities,row.activityOffset));
  p.warnings.push('行財政改革の重点課題評価票に「事務・事業名」として記載された個別取組。予算上の個別事業であるとは限らない。記入済みの年度別取組だけを採用し、空欄の将来年度や全選択肢が並ぶ達成度評価、効果額を推測しない。');
  r.projects.push(p);r.units.push({start:first.start,name:row.name,status:'supported',reason:row.reason});
 }
 r.status='reviewed_annual_reform_work_units';return r;
}
