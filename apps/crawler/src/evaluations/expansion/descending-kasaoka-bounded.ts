import {createHash} from 'node:crypto';
import {kasaokaBounded as c} from './descending-kasaoka-bounded-map';
import {type CachedInput,project,evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
/** Only complete, individually reviewed annual rows within the exact saved prefix. */
export function boundedKasaokaScope(i:CachedInput){
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||!i.truncated||i.format!=='pdf'||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.startsWith(c.proof))return null;
 for(const row of c.rows){
  if(i.text.slice(row.start,row.end)!==row.raw||!row.raw.startsWith(row.header+'\n')||!row.header.includes(row.name)||!row.raw.includes('（R7） R8 R9 R10 R11')||!/\n実績 [0-9△,]+(?: |\n)/.test(row.raw)||row.end>=i.text.length||i.text.slice(row.end,row.end+row.boundary.length)!==row.boundary)return null;
 }
 return c;
}
export function reviewBoundedKasaoka(i:CachedInput):LayoutReview|null{
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode)return null;
 const config=boundedKasaokaScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Individually reviewed complete annual tables inside verified prefix; missing tail remains held.'};
 if(!config){r.status='source_integrity_hold';r.reason='Pinned prefix, original identity, annual header or complete row boundary differs';return r;}
 for(const row of config.rows){
  const p=project(i,'bounded-row-'+row.start,row.name,c.evaluationYear,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof,0));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of config.holds)r.units.push({start:h.start,status:h.status,reason:h.reason});
 r.units.push({start:i.text.length,status:'missing_body_hold',reason:`Only ${c.exportedCharacters} of ${c.originalCharacters} characters available; no listed continuation. The incomplete final table and absent tail remain excluded.`});r.proofs=[c.proof];return r;
}
