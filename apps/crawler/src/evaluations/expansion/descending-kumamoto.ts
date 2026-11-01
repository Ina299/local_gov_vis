import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput, project, evidence} from './shared';
import {kumamotoRows} from './descending-kumamoto-map';
interface Row {name:string; start:number; raw:string; note:string; year?:number; yearProof?:string}
interface Config {sourceId:string;municipalityCode:string;year:number|null;evaluationYear?:number;pageId?:string;pageHash?:string;pageProof?:string;proof:string;fullTextSha256:string;rows:Row[];holds:{start:number;raw:string;reason:string;status?:string}[]}
export function reviewKumamoto(i:CachedInput, inputs:CachedInput[]=[]):LayoutReview|null {
 const c=(kumamotoRows as Config[]).find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_businesses',reason:'Source-specific named annual implementations; no policy KPI or financial-column inference.',proofs:[]};
 if(i.truncated||i.format!=='pdf'||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!i.text.includes(c.proof)){r.status='source_integrity_hold';r.reason='Reviewed source hash, complete body or explicit year proof differs';return r;}
 const page=c.pageId?inputs.find(p=>p.sourceId===c.pageId&&p.municipalityCode===i.municipalityCode):undefined;
 if(c.pageId&&(!page||page.truncated||createHash('sha256').update(page.text).digest('hex')!==c.pageHash||!page.text.includes(c.pageProof!))){r.status='annual_identity_hold';r.reason='Saved official link-year evidence absent or changed';return r;}
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||row.yearProof&&!i.text.includes(row.yearProof))throw new Error('Reviewed Kumamoto row evidence mismatch');
  const p=project(i,'literal-'+row.start,row.name,c.evaluationYear??null,row.raw,row.start);if(page)p.evidence.push(evidence(page,c.pageProof!));p.projectCode=null;p.evaluatedFiscalYear=row.year??c.year;p.evidence.push(evidence(i,c.proof));if(row.yearProof)p.evidence.push(evidence(i,row.yearProof));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw new Error('Reviewed Kumamoto hold evidence mismatch');r.units.push({start:h.start,status:h.status??'identity_or_period_hold',reason:h.reason});}
 r.proofs=[c.proof];return r;
}
