import {createHash} from 'node:crypto';
import {configs} from './descending-kanagawa-minami-extra-map';
import {project,evidence,type CachedInput} from './shared';
export {configs};
export function reviewMinamiExtra(i:CachedInput){
 const c=configs.find(x=>x.sourceId===i.sourceId&&x.municipalityCode===i.municipalityCode);
 if(!c)return null;
 const r={projects:[] as ReturnType<typeof project>[],units:[] as any[],proofs:[] as string[],status:'source_identity_hold',reason:'Named programmes with exact annual implementation evidence; aggregate report years are not inferred.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 for(const row of c.rows){
  if(row.parts.map(x=>x.raw).join('')!==row.name)throw Error('Programme fragments do not reconstruct name');
  for(const x of [...row.parts,...row.proofs])if(i.text.slice(x.start,x.start+x.raw.length)!==x.raw)throw Error('Programme evidence mismatch');
  const first=row.parts[0];const p=project(i,'extra-programme-'+first.start,row.name,null,first.raw,first.start);
  p.projectCode=null;p.evaluatedFiscalYear=row.year;p.evaluationYear=row.evaluationYear;
  p.evidence.push(...row.parts.slice(1).map(x=>evidence(i,x.raw,x.start)),...row.proofs.map(x=>evidence(i,x.raw,x.start)));
  p.warnings.push('名称断片と実施年度の明示箇所のみを採用。複数年度総括の全数を単年度実績と解釈せず、金額・人数・評価点・部署を推測しない。');
  r.projects.push(p);r.units.push({start:first.start,name:row.name,status:'supported',reason:row.reason});
 }
 r.status='reviewed_named_annual_programmes';return r;
}
