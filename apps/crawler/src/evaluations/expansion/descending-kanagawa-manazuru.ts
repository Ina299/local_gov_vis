import{reviewed}from'./descending-kanagawa-manazuru-map';
import {createHash} from 'node:crypto';

import {project,evidence,type CachedInput} from './shared';
export const configs:any[]=reviewed;
const compact=(s:string)=>s.replace(/\s+/g,'').normalize('NFKC');
export function reviewManazuru(i:CachedInput){
 const c=configs.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r={projects:[] as ReturnType<typeof project>[],units:[] as any[],proofs:[],status:'source_integrity_hold',reason:'Complete named facility-management committee assessments; bundled nursing/visiting service is one assessment unit.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(!i.text.startsWith(c.reportProof)||i.text.slice(c.periodStart,c.periodStart+c.periodProof.length)!==c.periodProof)throw Error('Manazuru report/year proof mismatch');
 const report=compact(c.reportProof),ev=report.match(/(令和|平成)(元|\d+)年度/);if(!ev||c.evaluationYear!==(ev[1]==='令和'?2018:1988)+(ev[2]==='元'?1:+ev[2]))throw Error('Manazuru evaluation year mismatch');
 const ys=[...compact(c.periodProof).matchAll(/(令和|平成)(元|\d+)年度/g)].map(m=>(m[1]==='令和'?2018:1988)+(m[2]==='元'?1:+m[2]));if(JSON.stringify([...new Set(ys)].sort())!==JSON.stringify(c.explicitFiscalYears))throw Error('Manazuru explicit target year mismatch');
 if(c.rows.length!==(c.evaluationYear===2026?6:c.evaluationYear===2017?2:5))throw Error('Manazuru unit count mismatch');
 for(const row of c.rows){
  if(i.text.slice(row.start,row.end)!==row.raw||createHash('sha256').update(row.raw).digest('hex')!==row.rawSha256||i.text.slice(row.nameStart,row.nameStart+row.nameRaw.length)!==row.nameRaw||row.name!==row.nameRaw.replace(/\s+/g,'')||!row.raw.startsWith('(')||row.raw.includes('【巻 末資 料')||!row.raw.includes(row.ratingRaw)||i.text.slice(row.ratingStart,row.ratingStart+row.ratingRaw.length)!==row.ratingRaw||JSON.stringify(row.years)!==JSON.stringify(c.explicitFiscalYears))throw Error('Manazuru bounded identity/rating mismatch');
  const printed=compact(row.ratingRaw);
  for(const y of row.years){
   const v=row.ratings.find((x:any)=>x.year===y);if(!v||!printed.includes(row.years.length===2?`平成${y-1988}年度が「${v.value}」`:`「${v.value}」`))throw Error('Manazuru annual rating mismatch');
   const p=project(i,`manazuru-facility-${row.serial}-${y}`,row.name,c.evaluationYear,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=y;p.evidence.push(evidence(i,c.reportProof,0),evidence(i,c.periodProof,c.periodStart));p.ratings.push({kind:'external',label:'指定管理者管理運営状況評価委員会の総合評価',value:v.value,scale:null,evidence:evidence(i,row.ratingRaw,row.ratingStart)});p.warnings.push('指定管理施設の管理運営評価。看護施設と訪問看護を一括評価した年は1評価単位として保持。自己評価・所管課評価と委員会総合評価を混同しない。満点は年度・施設で異なるため統一換算せず、印字された評語と点数のみを保持。金額や年度別内訳は推測しない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:`Explicit fiscal year ${y}, bounded facility assessment and committee narrative judgement.`});
  }
 }
 r.status='reviewed_facility_assessments';return r;
}
