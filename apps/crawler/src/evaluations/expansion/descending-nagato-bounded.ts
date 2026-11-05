import {createHash} from 'node:crypto';
import {nagatoBounded as c} from './descending-nagato-bounded-map';
import {type CachedInput,project,evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
/** Only the eight complete sheets pinned inside this recorded prefix. Missing tail is never reconstructed. */
export function boundedNagatoScope(i:CachedInput){
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||!i.truncated||i.format!=='pdf'||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.includes(c.proof))return null;
 for(const row of c.rows){
  const body=i.text.slice(row.contextStart,row.end);
  if(body!==row.context||!/^具体施策 \d+\n/.test(body)||!/^具体施策 \d+\n/.test(i.text.slice(row.end))||!body.includes('総合評価')||!body.includes('事 業 名 '+row.name)||i.text.slice(row.start,row.start+row.raw.length)!==row.raw)return null;
 }
 return c;
}
export function reviewBoundedNagato(i:CachedInput):LayoutReview|null{
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode)return null;
 const config=boundedNagatoScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Complete source-matched individual sheets within verified cached prefix; original tail remains absent.'};
 if(!config){r.status='source_integrity_hold';r.reason='Pinned prefix identity, hash, completeness boundaries or explicit year proof differs';return r;}
 for(const row of config.rows){
  const p=project(i,'bounded-sheet-'+row.contextStart,row.name,c.evaluationYear,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof),evidence(i,row.context,row.contextStart));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Complete sheet through the next concrete-policy header; fiscal year2023 and evaluation2024 explicitly distinguished.'});
 }
 r.units.push({start:i.text.length,status:'missing_body_hold',reason:`Only ${c.exportedCharacters} of ${c.originalCharacters} recorded characters cached; no listed continuation. Incomplete final sheet and missing tail excluded.`});r.proofs=[c.proof];return r;
}
