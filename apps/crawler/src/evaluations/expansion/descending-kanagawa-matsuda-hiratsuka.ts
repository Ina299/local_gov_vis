import{createHash}from'node:crypto';
import{configs}from'./descending-kanagawa-matsuda-hiratsuka-map';
import{project,evidence,type CachedInput}from'./shared';
export{configs};
export function reviewMatsudaHiratsuka(i:CachedInput){
 const c=configs.find(x=>x.sourceId===i.sourceId&&x.municipalityCode===i.municipalityCode);if(!c)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Explicit individual initiative/grant names, excluding aggregate indicators and ambiguous aliases.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(i.text.slice(c.yearOffset,c.yearOffset+c.yearQuote.length)!==c.yearQuote)throw Error('Named annual source scope mismatch');
 for(const row of c.rows){
  if(row.raw!==row.name||i.text.slice(row.start,row.start+row.raw.length)!==row.raw)throw Error('Named title mismatch');
  const p=project(i,'named-annual-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.yearQuote,c.yearOffset));
  if(row.activities!==null&&row.activityOffset!==null){if(i.text.slice(row.activityOffset,row.activityOffset+row.activities.length)!==row.activities)throw Error('Named grant implementation mismatch');p.activities=row.activities;p.evidence.push(evidence(i,row.activities,row.activityOffset));}
  p.warnings.push('当該年度の資料に明示された個別取組名・補助金名のみ。政策章や指標数・全体事業数を個別事業にせず、交錯した評語、将来方向、決算見込総額、実績が不明な当年度の事業を推測で割り当てない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Exact printed name and annual scope; all uncertain fields omitted.'});
 }
 for(const h of c.ledger)if(h.status!=='proposed')r.units.push({start:h.start,name:h.name,status:h.status,reason:'reason'in h?h.reason:'Previously covered or repeated same-annual identity.'});
 r.status='reviewed_named_annual_units';return r;
}
