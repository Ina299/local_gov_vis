import {createHash}from'node:crypto';
import{reviewed}from'./descending-kanagawa-hayama-map';
import{project,evidence,type CachedInput}from'./shared';
export const config=reviewed;
export function reviewHayama(i:CachedInput){
 if(i.sourceId!==config.sourceId||i.municipalityCode!==config.municipalityCode)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Exact complete report and explicit evaluation/target-year scope required.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==config.sourceUrl||i.sourceSha256!==config.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==config.textSha256)return r;
 if(!i.text.startsWith('平成２２年度\n葉山町行政評価報告')||i.text.slice(config.yearOffset,config.yearOffset+config.yearQuote.length)!==config.yearQuote)throw Error('Explicit report fiscal year missing');
 const end=i.text.indexOf('（４）町の方向性「新規」',config.yearOffset);if(end<0)throw Error('New-project section boundary missing');
 for(const row of config.rows){
  for(const f of row.parts)if(f.start+f.raw.length>end||i.text.slice(f.start,f.start+f.raw.length)!==f.raw)throw Error('Individual historical title evidence mismatch');
  if(row.name!==row.parts.map(f=>f.raw).join(''))throw Error('Title must consist of source fragments');
  r.units.push({start:row.parts[0].start,name:row.name,status:row.status,reason:row.reason});if(row.status==='existing_same_year')continue;
  const f=row.parts[0],p=project(i,'historical-row-'+row.number,row.name,2010,f.raw,f.start);p.projectCode=String(row.number);p.evaluatedFiscalYear=2009;p.evidence=[...row.parts.map(f=>evidence(i,f.raw,f.start)),evidence(i,config.yearQuote,config.yearOffset),evidence(i,'平成２２年度\n葉山町行政評価報告',0)];p.warnings.push('平成22年度評価・平成21年度既存事業を区別し、別節の平成23年度新規2件は含めない。32行中の既存2件を保持し、残る行の原文名称だけを部分構造化。複合表記の19番・21番は各1項目のまま保持し、構成施策へ分割しない。休廃止・見直しを廃止年度の実施事業と誤認しない。交錯した評語・部課・金額を推測結合しない。報告書全体345事業の網羅性は主張しない。');r.projects.push(p);
 }r.units.push({start:end,status:'excluded_future',reason:'Two explicitly new FY2011 proposals, outside FY2009 existing-project table.'});r.status='reviewed_historical_names';r.proofs=[config.yearQuote];return r;
}
