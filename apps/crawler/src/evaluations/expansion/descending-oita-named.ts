import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
import {oitaNamedRows} from './descending-oita-named-map';
export function reviewOitaNamed(i:CachedInput):LayoutReview|null{
 const c=oitaNamedRows.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_named_business_mentions',reason:'Only expressly named businesses with actual-year execution descriptions; policy chapter titles and future plans are not projects.',proofs:[c.proof]};
 if(i.truncated||i.format!=='pdf'||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256){r.status='source_integrity_hold';return r;}
 for(const row of c.rows){if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw)continue;const p=project(i,'named-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof,i.text.indexOf(c.proof)));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit business name inside bounded actual-year narrative, no policy-wide figures or financial values transferred.'});}
 r.units.push({start:0,status:'related_policy_context',reason:'Other reform headings describe policy directions, routine administration, facilities or multiple unnamed activities. Individual budget-business identity is not established; retained as original related evidence.'});return r;
}
