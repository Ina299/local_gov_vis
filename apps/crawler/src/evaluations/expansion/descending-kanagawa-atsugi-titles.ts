import{createHash}from'node:crypto';
import{configs}from'./descending-kanagawa-atsugi-titles-map';
import{project,evidence,type CachedInput}from'./shared';
export{configs};
export function reviewAtsugiTitles(i:CachedInput){
 const c=configs.find(x=>x.sourceId===i.sourceId&&x.municipalityCode===i.municipalityCode);if(!c)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Explicit annual evaluation table business-name fragments only.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(i.text.slice(c.yearOffset,c.yearOffset+c.yearQuote.length)!==c.yearQuote)throw Error('Atsugi evaluation-year mismatch');
 for(const row of c.rows){
  if(row.parts.map(x=>x.raw).join('').replace(/\s/g,'')!==row.name)throw Error('Atsugi title mismatch');
  for(const x of row.parts)if(i.text.slice(x.start,x.start+x.raw.length)!==x.raw)throw Error('Atsugi fragment mismatch');
  const first=row.parts[0],p=project(i,'reviewed-title-'+first.start,row.name,null,first.raw,first.start);
  p.projectCode=null;p.department=null;p.evaluationYear=c.year;p.evaluatedFiscalYear=null;
  p.evidence.push(...row.parts.slice(1).map(x=>evidence(i,x.raw,x.start)),evidence(i,c.yearQuote,c.yearOffset));
  p.warnings.push('年度別の事務事業評価結果一覧の個別事業名のみ。評価実施年度は表題に明示。対象実施年度、部署、事業番号、評点、金額は列混在・年度不明のため推測せず未設定。');
  r.projects.push(p);r.units.push({start:first.start,name:row.name,status:'supported',reason:row.reason});
 }
 r.status='reviewed_business_title_columns';r.proofs=[c.yearQuote];return r;
}
