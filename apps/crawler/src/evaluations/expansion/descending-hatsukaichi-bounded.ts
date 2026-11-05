import {createHash} from 'node:crypto';
import {hatsukaichiBounded as c} from './descending-hatsukaichi-bounded-map';
import {type CachedInput,project,evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
/** Only the reviewed named operations pinned inside this recorded prefix. Missing tail is never reconstructed. */
export function boundedHatsukaichiScope(i:CachedInput){
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||!i.truncated||i.format!=='pdf'||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.includes(c.proof))return null;
 for(const row of c.rows){
  const body=i.text.slice(row.contextStart,row.end);
  if(body!==row.context||!/^７．\s*昨年度の(?:取組の|取り組み)振り返り・問題・課題/.test(body)||!i.text.slice(row.end).startsWith('８．')||!body.includes(row.raw)||row.name!==row.raw.replace(/\n/g,'')||i.text.slice(row.start,row.start+row.raw.length)!==row.raw)return null;
 }
 return c;
}
export function reviewBoundedHatsukaichi(i:CachedInput):LayoutReview|null{
 if(i.sourceId!==c.sourceId||i.municipalityCode!==c.municipalityCode)return null;
 const config=boundedHatsukaichiScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Named annual operations in complete source-matched retrospective sections within verified cached prefix; original tail remains absent.'};
 if(!config){r.status='source_integrity_hold';r.reason='Pinned prefix identity, hash, completeness boundaries or explicit year proof differs';return r;}
 for(const row of config.rows){
  const p=project(i,'bounded-activity-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof),evidence(i,row.context,row.contextStart));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit FY2024 retrospective operation bounded before future-direction section; no policy grades or financial values.'});
 }
 r.units.push({start:i.text.length,status:'missing_body_hold',reason:`Only ${c.exportedCharacters} of ${c.originalCharacters} recorded characters cached; no listed continuation. Incomplete final sheet and missing tail excluded.`});r.proofs=[c.proof];return r;
}
