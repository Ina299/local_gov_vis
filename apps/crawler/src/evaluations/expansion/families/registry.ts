/** Reviewed literal bindings, revalidated against the immutable, complete cache on every replay. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {evidence,project,type CachedInput} from '../shared';
import {normalized,type Reviewer} from './shared';
export interface Span {quote:string;start:number;end:number;sourceId?:string;sourceSha256?:string;fullTextSha256?:string}
export interface Binding {identityHold?:string;department?:string;projectCode?:string;departmentProof?:Span;codeProof?:Span;sourceId:string;municipalityCode:string;sourceSha256:string;fullTextSha256:string;family:string;name:string;titles:Span[];fiscalYear:number|null;evaluationYear:number|null;periods:(Span&{kind:string;year:number})[];extraProofs:Span[];warnings:string[];boundary:{start:number;end?:number;kind?:string;reason?:string};boundaryQuote?:string;contextListedTitle?:string;nameDerivation?:string}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const text=readFileSync(fileURLToPath(new URL('../../../../../../data/evaluations/cached-family-review-inputs/bindings.json',import.meta.url)),'utf8');
if(hash(text)!=='0fe08989c08317de7755fdd6239e330d049ab1dce3df7b5d5672a853a4e0098d')throw new Error('Reviewed family binding input changed');
export const bindings:Binding[]=JSON.parse(text);
function sourceFor(span:Span,input:CachedInput,contexts:CachedInput[]){
 const src=span.sourceId?contexts.find(x=>x.sourceId===span.sourceId):input;
 if(!src||src.truncated||(span.sourceSha256&&src.sourceSha256!==span.sourceSha256)||(span.fullTextSha256&&hash(src.text)!==span.fullTextSha256))throw new Error('Family context identity/completeness mismatch');
 if(!Number.isInteger(span.start)||span.start<0||span.end!==span.start+span.quote.length||src.text.slice(span.start,span.end)!==span.quote)throw new Error('Family exact quote/UTF16 mismatch');
 return src;
}
const years=(s:string)=>[...s.normalize('NFKC').replace(/\s/g,'').replace(/平成31\(令和元\)年度/g,'平成31年度令和元年度').matchAll(/(令和|平成)(元|\d+)年度/g)].map(m=>(m[1]==='令和'?2018:1988)+(m[2]==='元'?1:+m[2]));
export function materializeBinding(b:Binding,input:CachedInput,contexts:CachedInput[]){
 if(b.identityHold)throw new Error('Reviewed identity hold: '+b.identityHold);
 if(input.sourceId!==b.sourceId||input.municipalityCode!==b.municipalityCode||input.sourceSha256!==b.sourceSha256||hash(input.text)!==b.fullTextSha256||input.truncated)throw new Error('Family primary identity/hash/completeness mismatch');
 const all=[...b.titles,...b.periods,...b.extraProofs];for(const s of all)sourceFor(s,input,contexts);
 const derived=b.titles.map(x=>x.quote).join('').replace(/事\s*業\s*項\s*目/g,'').replace(/（\s*事\s*務\s*事\s*業\s*名\s*）/g,'');
 if(normalized(derived)!==normalized(b.name))throw new Error(`Family literal name derivation mismatch: ${b.name} / ${derived}`);
 if(b.boundary.start<0||b.boundary.start>b.titles[0].start||(b.boundary.end!==undefined&&(b.boundary.end>input.text.length||b.titles.some(s=>s.end>b.boundary.end!))))throw new Error('Family individual boundary mismatch');
 if(b.boundaryQuote&&!input.text.includes(b.boundaryQuote))throw new Error('Family header boundary quote mismatch');
 if(b.contextListedTitle&&!b.periods.some(p=>p.quote.includes(b.contextListedTitle!)))throw new Error('Family context document listing mismatch');
 for(const p of b.periods){
  if(!years(p.quote).includes(p.year))throw new Error(`Family explicit year mismatch: ${b.name} / ${p.quote}`);
  if(p.kind==='evaluation_previous_target'&&(!p.quote.includes('前年度')||b.fiscalYear!==p.year-1||b.evaluationYear!==p.year))throw new Error('Family previous-year context mismatch');
 }
 for(const [kind,y] of [['target',b.fiscalYear],['evaluation',b.evaluationYear]] as const){if(y!==null&&!b.periods.some(p=>(p.kind===kind&&p.year===y)||(p.kind==='evaluation_previous_target'&&(kind==='target'?p.year-1:p.year)===y)))throw new Error('Family year lacks explicit bound proof');}
 const first=b.titles[0],p=project(input,`family:${b.name}:${b.fiscalYear}:${b.projectCode??''}`,b.name,b.evaluationYear,first.quote,first.start);
 if(b.department&&(b.departmentProof?.quote!==b.department||b.codeProof?.quote!==b.projectCode))throw new Error('Family department/code literal mismatch');
 p.department=b.department??null;p.projectCode=b.projectCode??null;p.evaluatedFiscalYear=b.fiscalYear;p.evidence=all.map(s=>evidence(sourceFor(s,input,contexts),s.quote,s.start));p.warnings.push(...b.warnings);
 if(b.family==='sakai-unassessed-business-overviews')p.warnings.push('事業概要一覧の名称・対象年度のみ。個別評価の実施・評価結果を示すレコードではありません。');
 if(b.family==='nakashibetsu-explicit-business-list')p.warnings.push('施策評価内の明示された事務事業一覧の名称・年度のみ。施策の評価を個別事業の評価として扱いません。');
 return p;
}
export const familyReviewers:Record<string,Reviewer>={};
for(const code of new Set(bindings.map(b=>b.municipalityCode))){familyReviewers[code]=(input,contexts)=>{
 const rows=bindings.filter(b=>b.municipalityCode===code&&b.sourceId===input.sourceId);if(!rows.length)return null;
 return{family:rows[0].family,scope:'保存本文で確認した個別事業の名称・年度のみ。冊子全体の収録完了・個別評価実施・財務抽出完了を意味しない。',units:rows.map(b=>({unit:`${b.sourceId}:${b.titles[0].start}`,name:b.name,fiscalYear:b.fiscalYear,status:b.identityHold?'identity_hold':'reviewed_literal_identity',reason:b.identityHold??b.boundary.reason??b.boundary.kind??'Reviewed explicit individual name boundary'})),projects:rows.filter(b=>!b.identityHold).map(b=>materializeBinding(b,input,contexts))};
};}
