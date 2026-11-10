import {createHash} from 'node:crypto';
import {reviewed} from './descending-kanagawa-minami-grants-map';
import {project,evidence,type CachedInput} from './shared';
export const config=reviewed;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function reviewMinamiashigaraGrants(i:CachedInput,inputs:CachedInput[]=[]){
 const c=config;if(i.municipalityCode!==c.municipalityCode||i.sourceId!==c.sourceId)return null;
 const r={projects:[] as ReturnType<typeof project>[],units:[] as any[],proofs:[] as string[],status:'source_identity_hold',reason:'Exact saved grant book and official evaluation-year link required; no single execution fiscal year inferred.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||sha(i.text)!==c.textSha256)return r;
 const nav=inputs.find(n=>n.municipalityCode===c.municipalityCode&&n.sourceId===c.navigationSourceId&&!n.truncated&&n.sourceSha256===c.navigationSourceSha256&&sha(n.text)===c.navigationTextSha256);
 if(!nav||nav.text.slice(c.navigationOffset,c.navigationOffset+c.navigationQuote.length)!==c.navigationQuote)return r;
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||!row.municipalIdentity.includes('南足柄市')||i.text.slice(row.start,row.start+row.municipalIdentity.length)!==row.municipalIdentity)throw Error('Grant name or implementer evidence mismatch');
  r.units.push({start:row.start,name:row.name,status:row.status,reason:row.reason});if(row.status!=='proposal')continue;
  const p=project(i,'grant-review-'+row.start,row.name,2021,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=null;p.evidence.push(evidence(i,row.municipalIdentity,row.start),evidence(nav,c.navigationQuote,c.navigationOffset));p.warnings.push('令和３年度の評価結果として保存された複数年度の交付金評価。単一の実施年度へ置換しない。実施主体に南足柄市を明記した事業で、共同事業は共同事業の名称を保持。県・複数市町の総事業費を本市支出へ割り当てず、金額・KPI・評語は未収録。同名の既存令和５年度記録がある３事業は年度範囲の重複確認待ちとして追加しない。');r.projects.push(p);
 }
 r.status='reviewed_grant_names';r.proofs=[c.navigationQuote];return r;
}
