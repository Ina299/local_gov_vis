import {createHash} from 'node:crypto';

import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import{reviewed}from'./descending-nagano-oshika-map';
export const configs:any[]=reviewed;
export function reviewOshika(i:CachedInput):LayoutReview|null {
 const c=configs.find(c=>c.source.sourceId===i.sourceId&&c.source.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],proofs:[],status:'reviewed_named_strategy_actions',reason:'Only literal named actions; KPI/policy headings and future-year plans excluded.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.source.url||i.sourceSha256!==c.source.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.source.fullTextSha256){r.status='source_integrity_hold';return r;}
 if(c.proof!=='評価委員会シート\n\n平成27年度\n施策の方向性')throw Error('Explicit strategy years missing');
 for(const row of c.rows){if(row.evaluatedFiscalYear!==null||row.evaluationYear!==2015)throw Error('Wrong strategy year');let end=row.start;const name=row.segments.map((s:any)=>{if(s.start<end||s.start+s.raw.length>row.start+row.raw.length||i.text.slice(s.start,s.start+s.raw.length)!==s.raw)throw Error('Title fragment mismatch');end=s.start+s.raw.length;return s.raw;}).join('').replace(/\s/g,'');if(name!==row.name.replace(/\s/g,''))throw Error('Nonliteral title');if(row.start<row.proofStart||row.start+row.raw.length>row.proofStart+row.proof.length)throw Error('Unbounded proof');
 const p=project(i,'nagano-oshika-'+row.start,row.name,2015,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=null;
 for(const q of [{raw:c.proof,start:c.proofStart},{raw:row.proof,start:row.proofStart},...row.segments])p.evidence.push(evidence(i,q.raw,q.start));
 p.warnings.push('平成27年度評価委員会シートの個別事業名欄。評価対象の単年度は推測せず未設定。個別名称のみを部分構造化し、政策・KPI、繰越事業・未実施・翌年度計画、列位置不明の評価・担当課・金額を推測しません。記載が完了実績を保証するものではなく原文の実施状況を参照してください。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});}return r;
}
