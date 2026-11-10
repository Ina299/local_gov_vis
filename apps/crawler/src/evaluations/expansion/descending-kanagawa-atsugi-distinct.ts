import{createHash}from'node:crypto';
import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{pairs}from'./descending-kanagawa-atsugi-distinct-map';
/** Only exact record pairs whose same-year, same-name departmental rows were individually verified. */
export function distinctAtsugiDepartmentRows(a:ProjectEvaluation,b:ProjectEvaluation):boolean{
 const hash=(p:ProjectEvaluation)=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
 return pairs.some(x=>x.oldDepartment!==x.newDepartment&&((a.id===x.oldId&&b.id===x.newId&&hash(a)===x.oldHash&&hash(b)===x.newHash)||(b.id===x.oldId&&a.id===x.newId&&hash(b)===x.oldHash&&hash(a)===x.newHash)));
}
