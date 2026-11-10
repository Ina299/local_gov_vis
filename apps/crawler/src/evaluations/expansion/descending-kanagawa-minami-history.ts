import {createHash} from 'node:crypto';
import {config} from './descending-kanagawa-minami-history-map';
import {project,evidence,type CachedInput} from './shared';
export {config};
export function reviewMinamiHistory(i:CachedInput){
 if(i.sourceId!==config.sourceId||i.municipalityCode!==config.municipalityCode)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Exact named historical business report required; evaluation year distinct from multi-year execution period.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==config.sourceUrl||i.sourceSha256!==config.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==config.textSha256)return r;
 for(const [at,raw]of [[config.periodOffset,config.periodQuote],[config.dateOffset,config.dateQuote]]as const)if(i.text.slice(at,at+raw.length)!==raw)throw Error('Historical period/date mismatch');
 for(const row of config.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||i.text.slice(row.ratingStart,row.ratingStart+row.rating.length)!==row.rating)throw Error('Historical title/grade mismatch');
  const p=project(i,'historical-summary-'+row.start,row.name,2020,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=null;p.evidence.push(evidence(i,config.dateQuote,config.dateOffset),evidence(i,config.periodQuote,config.periodOffset));p.ratings.push({kind:'self',label:'重点事業評価',value:row.rating,scale:null,evidence:evidence(i,row.rating,row.ratingStart)});p.warnings.push('市企画課の令和2年11月評価報告。平成30年度〜令和元年度の重点事業の評価で、単一年度へ置換せず、2年分の同一記録を複製しない。33の重点事業の名称と一覧表の評語のみ。政策章・方針を追加事業にせず、本文の件数や費用を推測結合しない。審議会への報告・意見聴取を独立の外部評価として増やさない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit numbered priority business and directly paired grade; multi-year scope preserved.'});
 }r.status='reviewed_historical_business_summary';r.proofs=[config.periodQuote,config.dateQuote];return r;
}
