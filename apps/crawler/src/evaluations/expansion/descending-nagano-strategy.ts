import {createHash} from 'node:crypto';

import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import{reviewed}from'./descending-nagano-strategy-map';
export const configs:any[]=reviewed;
export function reviewStrategy(i:CachedInput):LayoutReview|null {
 const c=configs.find(c=>c.source.sourceId===i.sourceId&&c.source.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],proofs:[],status:'reviewed_named_strategy_actions',reason:'Only literal named actions; KPI/policy headings and future-year plans excluded.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.source.url||i.sourceSha256!==c.source.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.source.fullTextSha256){r.status='source_integrity_hold';return r;}
 if(c.proof!=='平成２９年度\n王滝村総合戦略評価報告書'||!c.targetProof.includes('平成 28 年度の施策'))throw Error('Explicit strategy years missing');
 for(const row of c.rows){if(row.evaluatedFiscalYear!==2016||row.evaluationYear!==2017)throw Error('Wrong strategy year');let end=row.start;const name=row.segments.map((s:any)=>{if(s.start<end||s.start+s.raw.length>row.start+row.raw.length||i.text.slice(s.start,s.start+s.raw.length)!==s.raw)throw Error('Title fragment mismatch');end=s.start+s.raw.length;return s.raw;}).join('').replace(/\s/g,'');if(name!==row.name.replace(/\s/g,''))throw Error('Nonliteral title');if(row.start<row.proofStart||row.start+row.raw.length>row.proofStart+row.proof.length)throw Error('Unbounded proof');
 const p=project(i,'nagano-strategy-'+row.start,row.name,2017,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=2016;
 for(const q of [{raw:c.proof,start:c.proofStart},{raw:c.targetProof,start:c.targetProofStart},{raw:row.proof,start:row.proofStart},...row.segments])p.evidence.push(evidence(i,q.raw,q.start));
 p.warnings.push('平成29年度評価報告の明記対象は平成28年度。個別名称のみを部分構造化し、政策・KPI、翌年度計画、列位置不明の評価・担当課・金額を推測しません。記載が完了実績を保証するものではなく原文の実施状況を参照してください。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});}return r;
}
