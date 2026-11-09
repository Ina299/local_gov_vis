import {createHash} from 'node:crypto';

import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import{configs as data}from'./descending-gifu-mitake-map';export const config:any=data[0];
export function reviewMitake(i:CachedInput):LayoutReview|null {
 const c=config;if(i.sourceId!==c.source.sourceId||i.municipalityCode!==c.source.municipalityCode)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_businesses',reason:'Reviewed literal name cells in settlement-results report; financial and evaluation-year columns not inferred.',proofs:[]};
 if(i.sourceUrl!==c.source.url||i.sourceSha256!==c.source.sourceSha256||i.format!=='pdf'||i.truncated||createHash('sha256').update(i.text).digest('hex')!==c.source.fullTextSha256){r.status='source_integrity_hold';return r;}
 if(c.year!==2024||c.evaluationYear!==null||!i.text.startsWith(c.proof)||c.proof!=='令 和 ６ 年 度\n\n主要な施策の成果に関する説明書\n\n御 嵩 町'||c.queueAudit.length!==150)throw Error('Mitake year/coverage proof mismatch');
 const seen=new Set<string>();
 for(const row of c.rows){
  if(row.evaluatedFiscalYear!==2024||row.evaluationYear!==null||row.department!==null||i.text.slice(row.start,row.start+row.raw.length)!==row.raw||!row.segments.length)throw Error('Mitake boundary/year mismatch');
  let end=row.start;for(const seg of row.segments){if(seg.start<end||seg.start+seg.raw.length>row.start+row.raw.length||i.text.slice(seg.start,seg.start+seg.raw.length)!==seg.raw)throw Error('Mitake segment mismatch');end=seg.start+seg.raw.length;}
  if(row.segments.map((s:any)=>s.raw.replace(/\s/g,'')).join('')!==row.name||seen.has(row.name))throw Error('Mitake literal identity mismatch');seen.add(row.name);
  const p=project(i,'mitake-reviewed-'+row.start,row.name,null,row.raw,row.start);p.evaluatedFiscalYear=2024;p.projectCode=null;
  p.evidence.push(evidence(i,c.proof));for(const seg of row.segments)p.evidence.push(evidence(i,seg.raw,seg.start));
  p.warnings.push('令和６年度の主要施策成果説明書の事業名称欄。決算書ページを事業番号に流用せず、提出日を評価実施年度に読み替えていません。前年度・当年度決算額、財源、評点、近傍の担当係は列対応を推測せず未抽出。繰越・未執行の掲載を含み、名称の掲載は当年度実施・完了の証明ではありません。同名・類似名の木材保管及び町有林管理は同一性未解決のため別途保留。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:row.note});
 }
 for(const h of c.holds){if(i.text.slice(h.start,h.start+h.raw.length)!==h.raw)throw Error('Mitake hold citation mismatch');r.units.push({start:h.start,name:h.name,status:'held',reason:h.reason});}
 r.proofs=[c.proof];return r;
}
