import {createHash} from 'node:crypto';
import {munakataPolicy as c} from './descending-munakata-policy-map';
import {type CachedInput,project,evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
export function boundedMunakataPolicyScope(i:CachedInput){
 if(c.sourceId!==i.sourceId||c.municipalityCode!==i.municipalityCode||!i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.startsWith(c.proof))return null;
 for(const r of c.rows){const body=i.text.slice(r.start,r.end);if(!body.startsWith('４．令和５年度の現状と課題と主な取り組み状況等')||!i.text.slice(r.end).startsWith('５．')||r.nameStart<r.start||r.nameStart+r.name.length>r.end||i.text.slice(r.nameStart,r.nameStart+r.name.length)!==r.name)return null;}
 return c;
}
export function reviewBoundedMunakataPolicy(i:CachedInput):LayoutReview|null{
 if(c.sourceId!==i.sourceId||c.municipalityCode!==i.municipalityCode)return null;
 const scope=boundedMunakataPolicyScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Only explicit named individual implementations in completed section4 contexts; not records for policy/KPI rows.'};
 if(!scope){r.status='source_integrity_hold';r.reason='Pinned prefix or target-year implementation-section boundaries differ';return r;}
 for(const row of scope.rows){const p=project(i,'bounded-policy-name-'+row.nameStart,row.name,null,row.name,row.nameStart);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof,0),evidence(i,i.text.slice(row.start,row.end),row.start));p.warnings.push('途中本文内で翌年度方針欄の手前まで揃う当年度取組欄に明記された個別名称のみ。政策章やKPI行は事業にせず、施策決算総額・満足度・次年度計画を転記しない。共同事業は市の単独実施と主張しない。');r.projects.push(p);r.units.push({start:row.nameStart,name:row.name,status:'supported',reason:'Explicit individual annual implementation, complete target-year context before section5'});}
 r.units.push({start:i.text.length,status:'missing_body_hold',reason:'Last policy text is cut at120000 of122251 recorded characters; no listed continuation. No extraction from cut section or KPI-only rows.'});r.proofs=[c.proof];return r;
}
