import{createHash}from'node:crypto';
import{configs}from'./descending-kanagawa-atsugi-titles-map';
import{project,evidence,type CachedInput}from'./shared';
export{configs};
export function reviewAtsugiTitles(i:CachedInput){
 const c=configs.find(x=>x.sourceId===i.sourceId&&x.municipalityCode===i.municipalityCode);if(!c)return null;
 const r={projects:[]as ReturnType<typeof project>[],units:[]as any[],proofs:[]as string[],status:'source_identity_hold',reason:'Explicit annual evaluation table business-name fragments only.'};
 if(i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||createHash('sha256').update(i.text).digest('hex')!==c.textSha256)return r;
 if(i.text.slice(c.yearOffset,c.yearOffset+c.yearQuote.length)!==c.yearQuote)throw Error('Atsugi evaluation-year mismatch');
 for(const rawRow of c.rows){
  const row=rawRow as typeof rawRow & {department?:string;departmentParts?:{raw:string;start:number}[];identityProof?:{raw:string;start:number}};
  if(row.parts.map(x=>x.raw).join('').replace(/\s/g,'')!==row.name)throw Error('Atsugi title mismatch');
  for(const x of row.parts)if(i.text.slice(x.start,x.start+x.raw.length)!==x.raw)throw Error('Atsugi fragment mismatch');
  const first=row.parts[0],p=project(i,'reviewed-title-'+first.start,row.name,null,first.raw,first.start);
  p.projectCode=null;p.department=row.department??null;p.evaluationYear=c.year;p.evaluatedFiscalYear=null;
  if(row.identityProof){const e=row.identityProof;if(i.text.slice(e.start,e.start+e.raw.length)!==e.raw)throw Error('Atsugi department proof mismatch');if(!row.department||row.departmentParts?.map(x=>x.raw).join('')!==row.department)throw Error('Atsugi department fragments mismatch');for(const f of row.departmentParts??[])if(f.start<e.start||f.start+f.raw.length>e.start+e.raw.length||i.text.slice(f.start,f.start+f.raw.length)!==f.raw)throw Error('Atsugi department not literally present');p.evidence.push(evidence(i,e.raw,e.start));}
  p.evidence.push(...row.parts.slice(1).map(x=>evidence(i,x.raw,x.start)),evidence(i,c.yearQuote,c.yearOffset));
  p.warnings.push(row.department?'個別行の部署名と名称断片を明示箇所で照合。対象実施年度・事業番号・評点・金額は推測せず未設定。':'年度別の事務事業評価結果一覧の個別事業名のみ。評価実施年度は表題に明示。対象実施年度、部署、事業番号、評点、金額は列混在・年度不明のため推測せず未設定。');
  r.projects.push(p);r.units.push({start:first.start,name:row.name,status:'supported',reason:row.reason});
 }
 for(const h of c.holds)r.units.push({start:h.start,name:'name'in h?h.name:null,status:'identity_hold',reason:h.reason});
 r.status='reviewed_business_title_columns';r.proofs=[c.yearQuote];return r;
}
