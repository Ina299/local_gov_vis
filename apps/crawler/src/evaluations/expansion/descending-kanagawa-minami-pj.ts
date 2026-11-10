import {createHash} from 'node:crypto';
import {configs} from './descending-kanagawa-minami-pj-map';
import {project,evidence,type CachedInput} from './shared';
export {configs};
export function reviewMinamiPJ(i:CachedInput){
 const config=configs.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!config)return null;
 const r={projects:[] as ReturnType<typeof project>[],units:[]as any[],status:'source_identity_hold',proofs:[]as string[],reason:'Exact full cached annual implementation-row source required; names only, no policy chapter/KPI expansion.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==config.sourceUrl||i.sourceSha256!==config.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==config.textSha256)return r;
 if(!i.text.startsWith(config.yearQuote))throw Error('Fiscal source header mismatch');
 for(const row of config.rows){
  const body=i.text.slice(row.start,row.end);if(createHash('sha256').update(body).digest('hex')!==row.contextSha256)throw Error('Reviewed row boundary mismatch');
  r.units.push({start:row.start,status:row.status,reason:row.reason,name:row.name});if(row.status!=='title_reviewed_proposal'||!row.parts||!row.name)continue;
  for(const p of row.parts)if(i.text.slice(p.start,p.start+p.raw.length)!==p.raw)throw Error('Title fragment mismatch');
  if(row.parts.map(p=>p.raw).join('')!==row.name)throw Error('Title not composed of exact fragments');
  const first=row.parts[0],p=project(i,'implementation-row-'+row.start,row.name,null,first.raw,first.start);p.projectCode=null;p.evaluatedFiscalYear=config.year;p.evidence=[...row.parts.map(part=>evidence(i,part.raw,part.start)),evidence(i,config.yearQuote,0)];if('implementationQuote'in row&&row.implementationQuote){const e=row.implementationQuote;p.evidence.push(evidence(i,e.raw,e.start));}p.warnings.push('各年度の事業実績の取組行に明記された名称のみを部分構造化。政策章・KPIを事業にせず、行を分割しない。前年度完結・再掲は追加しない。令和２年度の事業計画なし２行は個別実績の帰属不足で除外し、後年度の施設整備完了・開所は当該年度の明示された原文によって区別。部課・金額・評価を推測結合せず、計画・準備・中止を完了実績とは扱わない。');r.projects.push(p);
 }r.status='reviewed_individual_implementation_names';r.proofs=[config.yearQuote];return r;
}
