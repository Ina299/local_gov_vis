import{reviewNagiso}from'./descending-nagano-nagiso';
import {createHash} from 'node:crypto';

import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import{reviewed}from'./descending-nagano-nagiso-next-map';
export const configs:any[]=reviewed;
export function reviewNagisoNext(i:CachedInput):LayoutReview|null {
 const c=configs.find(c=>c.source.sourceId===i.sourceId&&c.source.municipalityCode===i.municipalityCode);if(!c)return null;
 let r:LayoutReview={projects:[],units:[],proofs:[],status:'reviewed_named_strategy_actions',reason:'Only literal named actions; KPI/policy headings and future-year plans excluded.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.source.url||i.sourceSha256!==c.source.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.source.fullTextSha256){r.status='source_integrity_hold';return r;}
 r=reviewNagiso(i)!;if(r.status==='source_integrity_hold')return r;
 if(c.proof!=='令和６年度\n\n主要事業成果報告書\n\n南木曽町')throw Error('Explicit strategy years missing');
 for(const row of c.rows){if(row.evaluatedFiscalYear!==2024||row.evaluationYear!==null)throw Error('Wrong strategy year');let end=row.start;const name=row.segments.map((s:any)=>{if(s.start<end||s.start+s.raw.length>row.start+row.raw.length||i.text.slice(s.start,s.start+s.raw.length)!==s.raw)throw Error('Title fragment mismatch');end=s.start+s.raw.length;return s.raw;}).join('').replace(/\s/g,'');if(name!==row.name.replace(/\s/g,''))throw Error('Nonliteral title');if(row.start<row.proofStart||row.start+row.raw.length>row.proofStart+row.proof.length)throw Error('Unbounded proof');
 const p=project(i,'nagano-nagiso-next-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=2024;
 for(const q of [{raw:c.proof,start:c.proofStart},{raw:row.proof,start:row.proofStart},...row.segments])p.evidence.push(evidence(i,q.raw,q.start));
 for(const a of row.alternatives??[])p.evidence.push(evidence(i,a.raw,a.start));p.warnings.push('令和6年度主要事業成果報告書の明記対象年度。個別名称のみを部分構造化し、政策・KPI、繰越事業・未実施・翌年度計画、列位置不明の評価・担当課・金額を推測しません。記載が完了実績を保証するものではなく原文の実施状況を参照してください。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});}return r;
}
