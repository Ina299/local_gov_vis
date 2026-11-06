import {createHash} from 'node:crypto';
import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import {shigaRows} from './descending-shiga-map';
export const configs=shigaRows as any[];
export function reviewShiga(i:CachedInput):LayoutReview|null {
 const c=configs.find((c:any)=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_businesses',reason:'Literal annual activities; source-specific complete cached evidence. No financial-column inference.',proofs:[]};
 if(i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||i.truncated||i.format!==c.format||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!i.text.includes(c.proof)){r.status='source_integrity_hold';return r;}
 if(c.evaluationYear&&(!c.evaluationProof||!i.text.includes(c.evaluationProof)||!c.evaluationProof.normalize('NFKC').includes('令和'+(c.evaluationYear-2018)+'年度')))throw Error('Shiga evaluation year proof mismatch');
 for(const row of c.rows){
  if(!Number.isInteger(row.start)||row.start<0||!row.raw||i.text.slice(row.start,row.start+row.raw.length)!==row.raw)throw Error('Shiga row evidence mismatch');
  if(row.titleSegments){const ranges=row.titleSegments.map((s:any)=>({start:s.start,end:s.start+s.raw.length})).sort((a:any,b:any)=>a.start-b.start);for(const s of row.titleSegments)if(!Number.isInteger(s.start)||!s.raw||s.start<row.start||s.start+s.raw.length>row.start+row.raw.length||i.text.slice(s.start,s.start+s.raw.length)!==s.raw)throw Error('Shiga title segment mismatch');if(ranges.some((s:any,n:number)=>n>0&&s.start<ranges[n-1].end)||row.name!==row.titleSegments.map((s:any)=>s.raw).join('').replace(/\s+/g,''))throw Error('Shiga title identity mismatch');}
  else if(row.titleFragments?.length!==1||row.titleFragments[0]!==row.raw||row.name!==row.raw.replace(/\s+/g,''))throw Error('Shiga literal title mismatch');
  const year=row.year??c.year;if(!Number.isInteger(year))throw Error('Shiga explicit target year missing');
  if(row.year!==undefined&&!row.yearProof||row.year===undefined&&!c.proof.normalize('NFKC').includes('令和'+(year-2018)+'年度'))throw Error('Shiga target year proof missing');
  if(row.yearProof&&(!i.text.includes(row.yearProof)||!row.yearProof.includes('令和'+String(year-2018).replace(/\d/g,(d:string)=>String.fromCharCode(d.charCodeAt(0)+65248))+'年度')))throw Error('Shiga annual result mismatch');
  const p=project(i,'literal-'+row.start+'-'+year,row.name,c.evaluationYear??null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=year;p.evidence.push(evidence(i,c.proof));if(c.evaluationProof)p.evidence.push(evidence(i,c.evaluationProof));if(row.yearProof)p.evidence.push(evidence(i,row.yearProof));if(row.titleSegments)for(const s of row.titleSegments)p.evidence.push(evidence(i,s.raw,s.start));
  if(row.activityProof){const a=row.activityProof;if(!Number.isInteger(a.start)||a.start<row.start||a.start+a.raw.length>row.start+row.raw.length||i.text.slice(a.start,a.start+a.raw.length)!==a.raw||a.raw!==row.yearProof)throw Error('Shiga yearly activity evidence mismatch');p.activities=a.raw;p.evidence.push(evidence(i,a.raw,a.start));}
  p.warnings.push(row.note);r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw Error('Shiga hold evidence mismatch');r.units.push({start:h.start,status:'duplicate_hold',reason:h.reason});}
 r.proofs=[c.proof];return r;
}
