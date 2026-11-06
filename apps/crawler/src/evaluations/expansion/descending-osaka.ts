import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput, project, evidence, stableId} from './shared';
import {osakaRows} from './descending-osaka-map';
interface Row {name:string; composedTitle?:{baseSegments:{start:number;raw:string}[];descriptionSegments:{start:number;raw:string}[]}; departmentSegments?:{raw:string;start:number}[]; department?:string; departmentProof?:{raw:string;start:number}; titleFragments?:string[]; titleSegments?:{start:number;raw:string}[]; start:number; raw:string; note:string; year?:number; yearProof?:string;context?:string;contextStart?:number}
interface Config {sourceId:string;municipalityCode:string;sourceUrl:string;sourceSha256:string;format:string;reviewStatus?:string;year:number|null;evaluationYear?:number;pageTargetYearProof?:string; pagePeriodProof?:string;pageYearContext?:string;pageYearContextStart?:number;pageId?:string;pageHash?:string;pageProof?:string;pageSourceSha256?:string;pageUrl?:string;proof:string;fullTextSha256:string;rows:Row[];holds:{start:number;raw:string;reason:string;status?:string}[]}
export function reviewOsaka(i:CachedInput, inputs:CachedInput[]=[]):LayoutReview|null {
 const c=(osakaRows as Config[]).find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:c.reviewStatus??'reviewed_literal_businesses',reason:'Source-specific named annual assessed activities; candidate counts do not assert implementation. No policy KPI or financial-column inference.',proofs:[]};
 if(i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||i.truncated||i.format!==c.format||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!i.text.includes(c.proof)){r.status='source_integrity_hold';r.reason='Reviewed source hash, complete body or explicit year proof differs';return r;}
 const page=c.pageId?inputs.find(p=>p.sourceId===c.pageId&&p.municipalityCode===i.municipalityCode):undefined;
 if(c.pageId&&(!page||page.truncated||createHash('sha256').update(page.text).digest('hex')!==c.pageHash||!page.text.includes(c.pageProof!)||page.sourceSha256!==c.pageSourceSha256||page.sourceUrl!==c.pageUrl)){r.status='annual_identity_hold';r.reason='Saved official link-year evidence absent or changed';return r;}
 if(c.pageYearContext&&(!page||!Number.isInteger(c.pageYearContextStart)||c.pageYearContextStart!<0||page.text.slice(c.pageYearContextStart!,c.pageYearContextStart!+c.pageYearContext.length)!==c.pageYearContext||!c.pageYearContext.includes(c.pageProof!)||!c.pageYearContext.includes('前年度'))){r.status='annual_identity_hold';r.reason='Annual page context or its exact saved offset differs';return r;}
 if(c.pagePeriodProof&&(!page||!page.text.includes(c.pagePeriodProof)||!c.pagePeriodProof.includes(String(c.evaluationYear)+'年度'))){r.status='annual_identity_hold';r.reason='Explicit saved evaluation fiscal-year heading absent';return r;}
 if(c.pageTargetYearProof&&(!page||c.year===null||!page.text.includes(c.pageTargetYearProof)||![String(c.year)+'年度','平成'+(c.year-1988)+'年度','令和'+(c.year-2018)+'年度'].some(y=>c.pageTargetYearProof!.replace(/\s+/g,'').includes(y)))){r.status='annual_identity_hold';r.reason='Explicit saved target fiscal-year proof absent or inconsistent';return r;}
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||row.yearProof&&!i.text.includes(row.yearProof))throw new Error('Reviewed Osaka row evidence mismatch');
  if(!row.composedTitle&&!row.titleFragments&&!row.titleSegments&&!row.raw.includes(row.name))throw new Error('Osaka title lacks literal evidence');
  if(row.titleFragments){let offset=0;for(const fragment of row.titleFragments){const at=row.raw.indexOf(fragment,offset);if(at<0)throw new Error('Osaka title fragment mismatch');offset=at+fragment.length;}if(row.name!==row.titleFragments.join('').replace(/\s+/g,''))throw new Error('Osaka title normalization mismatch');}
  if(row.titleSegments){
   if(row.titleFragments||row.titleSegments.length<2)throw new Error('Osaka title proof shape mismatch');
   const ranges=row.titleSegments.map(s=>({start:s.start,end:s.start+s.raw.length})).sort((a,b)=>a.start-b.start);
   for(const seg of row.titleSegments){
    if(!Number.isInteger(seg.start)||!seg.raw||seg.start<row.start||seg.start+seg.raw.length>row.start+row.raw.length||i.text.slice(seg.start,seg.start+seg.raw.length)!==seg.raw)throw new Error('Osaka title segment evidence mismatch');
   }
   if(ranges.some((a,n)=>n>0&&a.start<ranges[n-1].end)||row.name!==row.titleSegments.map(s=>s.raw).join('').replace(/\s+/g,''))throw new Error('Osaka title segment identity mismatch');
  }
  if(row.composedTitle){
   const ctitle=row.composedTitle,segments=[...ctitle.baseSegments,...ctitle.descriptionSegments];
   if(row.titleFragments||row.titleSegments||!ctitle.baseSegments.length)throw new Error('Osaka composed title shape mismatch');
   for(const seg of segments)if(!Number.isInteger(seg.start)||!seg.raw||seg.start<row.start||seg.start+seg.raw.length>row.start+row.raw.length||i.text.slice(seg.start,seg.start+seg.raw.length)!==seg.raw)throw new Error('Osaka composed title evidence mismatch');
   const ranges=segments.map(s=>({start:s.start,end:s.start+s.raw.length})).sort((a,b)=>a.start-b.start);
   const base=ctitle.baseSegments.map(s=>s.raw).join(''),description=ctitle.descriptionSegments.map(s=>s.raw).join('');
   if(ranges.some((a,n)=>n>0&&a.start<ranges[n-1].end)||row.name!==base+(description?'【説明名称：'+description+'】':''))throw new Error('Osaka composed title identity mismatch');
  }
  const p=project(i,'literal-'+row.start,row.name,c.evaluationYear??null,row.raw,row.start);if(row.departmentSegments){const ds=row.departmentSegments;if(row.departmentProof||!row.department||ds.length<2||row.department!==ds.map(d=>d.raw).join('').replace(/\s+/g,''))throw new Error('Osaka department segment identity mismatch');const ranges=ds.map(d=>({start:d.start,end:d.start+d.raw.length})).sort((a,b)=>a.start-b.start);for(const d of ds)if(!Number.isInteger(d.start)||!d.raw||d.start<row.start||d.start+d.raw.length>row.start+row.raw.length||i.text.slice(d.start,d.start+d.raw.length)!==d.raw)throw new Error('Osaka department segment evidence mismatch');if(ranges.some((a,n)=>n>0&&a.start<ranges[n-1].end))throw new Error('Osaka department segment overlap');p.department=row.department;for(const d of ds)p.evidence.push(evidence(i,d.raw,d.start));}else if(row.department||row.departmentProof){const d=row.departmentProof;if(!row.department||!d||d.raw.replace(/\s+/g,'')!==row.department||!Number.isInteger(d.start)||d.start<0||i.text.slice(d.start,d.start+d.raw.length)!==d.raw||row.contextStart!==d.start||!row.context?.startsWith(d.raw))throw new Error('Osaka department evidence mismatch');p.department=row.department;p.evidence.push(evidence(i,d.raw,d.start));}if(page){p.evidence.push(evidence(page,c.pageProof!));if(c.pageYearContext)p.evidence.push(evidence(page,c.pageYearContext,c.pageYearContextStart));}if(page&&c.pagePeriodProof)p.evidence.push(evidence(page,c.pagePeriodProof));if(page&&c.pageTargetYearProof)p.evidence.push(evidence(page,c.pageTargetYearProof));if(row.titleSegments)for(const seg of row.titleSegments)p.evidence.push(evidence(i,seg.raw,seg.start));if(row.composedTitle)for(const seg of [...row.composedTitle.baseSegments,...row.composedTitle.descriptionSegments])p.evidence.push(evidence(i,seg.raw,seg.start));p.projectCode=null;p.evaluatedFiscalYear=row.year??c.year;p.evidence.push(evidence(i,c.proof));if(row.yearProof)p.evidence.push(evidence(i,row.yearProof));if(row.context)p.evidence.push(evidence(i,row.context,row.contextStart));p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw new Error('Reviewed Osaka hold evidence mismatch');r.units.push({start:h.start,status:h.status??'identity_or_period_hold',reason:h.reason});}
 r.proofs=[c.proof];return r;
}

/** Narrow exception for the two source-proven Suita center rows; different departments alone never suffice. */
export function distinctSuitaDepartmentRows(a:ProjectEvaluation,b:ProjectEvaluation):boolean {
 if(a.municipalityCode!=='27205'||b.municipalityCode!=='27205'||a.projectName!=='地域子育て支援センター事業'||b.projectName!==a.projectName||!a.department||!b.department||a.department===b.department)return false;
 const c=(osakaRows as Config[]).find(x=>x.sourceId==='9eb3185abca640c0d074ee33')!;
 const identify=(p:ProjectEvaluation)=>{
  if(p.evaluatedFiscalYear!==2017||p.evaluationYear!==2018)return false;
  const row=c.rows.find(x=>x.name===p.projectName&&x.department===p.department&&x.departmentSegments);if(!row)return false;
  if(p.id!==stableId({sourceUrl:c.sourceUrl,municipalityCode:c.municipalityCode} as CachedInput,'literal-'+row.start,2018))return false;
  return [{raw:row.raw,start:row.start},...row.departmentSegments!].every(d=>p.evidence.some(e=>e.sourceUrl===c.sourceUrl&&e.sha256===c.sourceSha256&&e.rawText===d.raw&&e.cell===`extracted-text:chars:${d.start}-${d.start+d.raw.length}`));
 };
 return identify(a)&&identify(b);
}
