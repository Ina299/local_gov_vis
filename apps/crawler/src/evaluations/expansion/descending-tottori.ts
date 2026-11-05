import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput, project, evidence} from './shared';
import {tottoriRows} from './descending-tottori-map';
interface Row {name:string; composedTitle?:{baseSegments:{start:number;raw:string}[];descriptionSegments:{start:number;raw:string}[]}; department?:string; departmentProof?:{raw:string;start:number}; titleFragments?:string[]; titleSegments?:{start:number;raw:string}[]; start:number; raw:string; note:string; year?:number; yearProof?:string;context?:string;contextStart?:number}
interface Config {sourceId:string;municipalityCode:string;sourceUrl:string;sourceSha256:string;format:string;reviewStatus?:string;year:number|null;evaluationYear?:number;pageId?:string;pageHash?:string;pageProof?:string;pageSourceSha256?:string;pageUrl?:string;proof:string;fullTextSha256:string;rows:Row[];holds:{start:number;raw:string;reason:string;status?:string}[]}
export function reviewTottori(i:CachedInput, inputs:CachedInput[]=[]):LayoutReview|null {
 const c=(tottoriRows as Config[]).find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:c.reviewStatus??'reviewed_literal_businesses',reason:'Source-specific named annual assessed activities; candidate counts do not assert implementation. No policy KPI or financial-column inference.',proofs:[]};
 if(i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||i.truncated||i.format!==c.format||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!i.text.includes(c.proof)){r.status='source_integrity_hold';r.reason='Reviewed source hash, complete body or explicit year proof differs';return r;}
 const page=c.pageId?inputs.find(p=>p.sourceId===c.pageId&&p.municipalityCode===i.municipalityCode):undefined;
 if(c.pageId&&(!page||page.truncated||createHash('sha256').update(page.text).digest('hex')!==c.pageHash||!page.text.includes(c.pageProof!)||page.sourceSha256!==c.pageSourceSha256||page.sourceUrl!==c.pageUrl)){r.status='annual_identity_hold';r.reason='Saved official link-year evidence absent or changed';return r;}
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||row.yearProof&&!i.text.includes(row.yearProof))throw new Error('Reviewed Tottori row evidence mismatch');
  if(!row.composedTitle&&!row.titleFragments&&!row.titleSegments&&!row.raw.includes(row.name))throw new Error('Tottori title lacks literal evidence');
  if(row.titleFragments){let offset=0;for(const fragment of row.titleFragments){const at=row.raw.indexOf(fragment,offset);if(at<0)throw new Error('Tottori title fragment mismatch');offset=at+fragment.length;}if(row.name!==row.titleFragments.join('').replace(/\s+/g,''))throw new Error('Tottori title normalization mismatch');}
  if(row.titleSegments){
   if(row.titleFragments||row.titleSegments.length<2)throw new Error('Tottori title proof shape mismatch');
   const ranges=row.titleSegments.map(s=>({start:s.start,end:s.start+s.raw.length})).sort((a,b)=>a.start-b.start);
   for(const seg of row.titleSegments){
    if(!Number.isInteger(seg.start)||!seg.raw||seg.start<row.start||seg.start+seg.raw.length>row.start+row.raw.length||i.text.slice(seg.start,seg.start+seg.raw.length)!==seg.raw)throw new Error('Tottori title segment evidence mismatch');
   }
   if(ranges.some((a,n)=>n>0&&a.start<ranges[n-1].end)||row.name!==row.titleSegments.map(s=>s.raw).join('').replace(/\s+/g,''))throw new Error('Tottori title segment identity mismatch');
  }
  if(row.composedTitle){
   const ctitle=row.composedTitle,segments=[...ctitle.baseSegments,...ctitle.descriptionSegments];
   if(row.titleFragments||row.titleSegments||!ctitle.baseSegments.length)throw new Error('Tottori composed title shape mismatch');
   for(const seg of segments)if(!Number.isInteger(seg.start)||!seg.raw||seg.start<row.start||seg.start+seg.raw.length>row.start+row.raw.length||i.text.slice(seg.start,seg.start+seg.raw.length)!==seg.raw)throw new Error('Tottori composed title evidence mismatch');
   const ranges=segments.map(s=>({start:s.start,end:s.start+s.raw.length})).sort((a,b)=>a.start-b.start);
   const base=ctitle.baseSegments.map(s=>s.raw).join(''),description=ctitle.descriptionSegments.map(s=>s.raw).join('');
   if(ranges.some((a,n)=>n>0&&a.start<ranges[n-1].end)||row.name!==base+(description?'【説明名称：'+description+'】':''))throw new Error('Tottori composed title identity mismatch');
  }
  const p=project(i,'literal-'+row.start,row.name,c.evaluationYear??null,row.raw,row.start);if(row.department||row.departmentProof){const d=row.departmentProof;if(!row.department||!d||d.raw.replace(/\s+/g,'')!==row.department||!Number.isInteger(d.start)||d.start<0||i.text.slice(d.start,d.start+d.raw.length)!==d.raw||row.contextStart!==d.start||!row.context?.startsWith(d.raw))throw new Error('Tottori department evidence mismatch');p.department=row.department;p.evidence.push(evidence(i,d.raw,d.start));}if(page)p.evidence.push(evidence(page,c.pageProof!));if(row.titleSegments)for(const seg of row.titleSegments)p.evidence.push(evidence(i,seg.raw,seg.start));if(row.composedTitle)for(const seg of [...row.composedTitle.baseSegments,...row.composedTitle.descriptionSegments])p.evidence.push(evidence(i,seg.raw,seg.start));p.projectCode=null;p.evaluatedFiscalYear=row.year??c.year;p.evidence.push(evidence(i,c.proof));if(row.yearProof)p.evidence.push(evidence(i,row.yearProof));if(row.context)p.evidence.push(evidence(i,row.context,row.contextStart));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw new Error('Reviewed Tottori hold evidence mismatch');r.units.push({start:h.start,status:h.status??'identity_or_period_hold',reason:h.reason});}
 r.proofs=[c.proof];return r;
}


