import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput, project, evidence} from './shared';
import {kagawaRows} from './descending-kagawa-map';
interface Row {name:string; distinctScope?:'小学校'|'中学校'; titleFragments?:string[]; start:number; raw:string; note:string; year?:number; yearProof?:string;context?:string;contextStart?:number}
interface Config {sourceId:string;municipalityCode:string;sourceUrl:string;sourceSha256:string;format:string;reviewStatus?:string;year:number|null;evaluationYear?:number;pageId?:string;pageHash?:string;pageProof?:string;proof:string;fullTextSha256:string;rows:Row[];holds:{start:number;raw:string;reason:string;status?:string}[]}
export function reviewKagawa(i:CachedInput, inputs:CachedInput[]=[]):LayoutReview|null {
 const c=(kagawaRows as Config[]).find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:c.reviewStatus??'reviewed_literal_businesses',reason:'Source-specific named annual implementations; no policy KPI or financial-column inference.',proofs:[]};
 if(i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||i.truncated||i.format!==c.format||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!i.text.includes(c.proof)){r.status='source_integrity_hold';r.reason='Reviewed source hash, complete body or explicit year proof differs';return r;}
 const page=c.pageId?inputs.find(p=>p.sourceId===c.pageId&&p.municipalityCode===i.municipalityCode):undefined;
 if(c.pageId&&(!page||page.truncated||createHash('sha256').update(page.text).digest('hex')!==c.pageHash||!page.text.includes(c.pageProof!))){r.status='annual_identity_hold';r.reason='Saved official link-year evidence absent or changed';return r;}
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||row.yearProof&&!i.text.includes(row.yearProof))throw new Error('Reviewed Kagawa row evidence mismatch');
  if(row.titleFragments){let offset=0;for(const fragment of row.titleFragments){const at=row.raw.indexOf(fragment,offset);if(at<0)throw new Error('Kagawa title fragment mismatch');offset=at+fragment.length;}if(row.name!==row.titleFragments.join('').replace(/\s+/g,''))throw new Error('Kagawa title normalization mismatch');}
  const p=project(i,'literal-'+row.start,row.name,c.evaluationYear??null,row.raw,row.start);if(page)p.evidence.push(evidence(page,c.pageProof!));p.projectCode=null;p.evaluatedFiscalYear=row.year??c.year;p.evidence.push(evidence(i,c.proof));if(row.yearProof)p.evidence.push(evidence(i,row.yearProof));if(row.context)p.evidence.push(evidence(i,row.context,row.contextStart));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw new Error('Reviewed Kagawa hold evidence mismatch');r.units.push({start:h.start,status:h.status??'identity_or_period_hold',reason:h.reason});}
 r.proofs=[c.proof];return r;
}

/** Only the two fully reviewed Zentsuji school-level sheets may share a literal title/year. */
export function distinctKagawaSchoolSheets(a:ProjectEvaluation,b:ProjectEvaluation):boolean {
 if(a.id===b.id)return false;
 const c=(kagawaRows as Config[]).find(c=>c.sourceId==='e1a0df38cf0100052ac586c5');
 if(!c)return false;
 const scope=(p:ProjectEvaluation)=>{
  if(p.municipalityCode!=='37204'||p.projectName!=='パワーアップ事業'||p.evaluatedFiscalYear!==2024||p.evaluationYear!==null)return undefined;
  const row=c.rows.find(row=>row.distinctScope&&p.id===`cached-37204-${createHash('sha256').update(`${c.sourceUrl}\nliteral-${row.start}\nnull`).digest('hex').slice(0,24)}`);
  if(!row?.context||!p.evidence.some(e=>e.sourceUrl===c.sourceUrl&&e.sha256===c.sourceSha256&&e.rawText===row.context&&e.cell===`extracted-text:chars:${row.contextStart}-${row.contextStart!+row.context.length}`))return undefined;
  return row.distinctScope;
 };
 const sa=scope(a),sb=scope(b);return !!sa&&!!sb&&sa!==sb;
}
