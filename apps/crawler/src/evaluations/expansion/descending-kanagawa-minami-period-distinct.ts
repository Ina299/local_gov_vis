import{createHash}from'node:crypto';
import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{pairs}from'./descending-kanagawa-minami-period-distinct-map';
/** Only exact record pairs whose historical period and later annual rows were individually verified. */
export function distinctMinamiPeriodRows(a:ProjectEvaluation,b:ProjectEvaluation):boolean{
 const hash=(p:ProjectEvaluation)=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
 return pairs.some(x=>x.periodEndFiscalYear<x.annualFiscalYear&&((a.id===x.periodId&&b.id===x.annualId&&hash(a)===x.periodHash&&hash(b)===x.annualHash)||(b.id===x.periodId&&a.id===x.annualId&&hash(b)===x.periodHash&&hash(a)===x.annualHash)));
}
