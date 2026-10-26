import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import type {CachedInput} from '../shared';
export interface FamilyUnit {unit:string; name?:string; code?:string; fiscalYear?:number|null; status:string; reason:string; existingIds?:string[]}
export interface FamilyReview {family:string; units:FamilyUnit[]; projects:ProjectEvaluation[]; scope:string}
export const normalized=(s:string|null)=>s?.normalize('NFKC').replace(/\s/g,'')??'';
export const existingYearIdentity=(old:ProjectEvaluation[],name:string,fy:number,code?:string)=>old.filter(p=>p.evaluatedFiscalYear===fy&&(normalized(p.projectName)===normalized(name)||(code&&normalized(p.projectCode)===normalized(code))));
export function fiscalYear(era:string,n:string){const s=n.normalize('NFKC').replace(/\s/g,'');return(era==='令和'?2018:1988)+(s==='元'?1:Number(s));}
export type Reviewer=(input:CachedInput,contexts:CachedInput[],prior:ProjectEvaluation[],title:string)=>FamilyReview|null;
