import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
const usaIds=['3b4d3f01c897a10dbd464a56','8bdd2178b1a72d223861ef21','d441078fdf491a6209e626e5','7e49d2b6a1d0ee3924ff9deb','cc979af6f0ef71352a86cabb','d3b27a6c6ec48d22ca45aba8'];
export function reviewOitaReports(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode==='44213'&&i.sourceId==='4b4a506b459e8be8251cd379')return yufu(i);
 if(i.municipalityCode!=='44211')return null;
 if(i.sourceId==='1c601becae96cd3e81502e90'&&!i.truncated&&i.text.includes('令和７年度\n宇佐市まち・ひと・しごと創生総合戦略進捗状況について')&&i.text.endsWith('10'))return{projects:[],units:[{start:0,status:'excluded_demographic_report',reason:'Ten-page population/birth/migration analysis; no individual business name/evaluation sheets. Listing municipalities in demographic tables does not assign projects.'}],status:'excluded_demographic_report',reason:'Cached document is demographic analysis despite linked evaluation title. Individual evaluation appendix is absent from this complete asset.',proofs:['９．過去２年間の大分県内市町村別社会増減の推移']};
 if(!usaIds.includes(i.sourceId))return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_grant_sheets',reason:'Top-level grant sheets only; historical execution year must be unique within the sheet. Subactivities and historical completion summaries are not split into new independent grant records.',proofs:[]};
 if(i.truncated||i.format!=='pdf'||!i.text.includes('宇佐市まち・ひと・しごと創生総合戦略'))return r;
 const hs=[...i.text.matchAll(/^交付対象事業$/gm)];
 for(let n=0;n<hs.length;n++){
 const start=hs[n].index!,raw=i.text.slice(start,hs[n+1]?.index??i.text.length),m=/^交付対象事業\n(空がつなぐまち・ひとづくり交流事業)\n/m.exec(raw)??/※実績額は交付金ベース\n+([^\n]+)/.exec(raw),years=[...new Set([...raw.matchAll(/(H30|20\d\d)年度実績額/g)].map(x=>x[1]==='H30'?2018:+x[1]))];
 if(!m){r.units.push({start,status:'excluded_future_plan',reason:'No actual-results basis heading; allocation/planning sheet cannot become actual annual record'});continue;}
 const name=m[1];if(/^\d|千円/.test(name)||years.length!==1||!raw.includes('【評価】')){r.units.push({start,name,status:'annual_or_title_hold',reason:years.length!==1?'Conflicting/missing explicit execution-year headings in bounded sheet: '+years.join(','):'Flattened heading does not identify a unique title; exact title placement must be resolved'});continue;}
 const off=start+m.index+m[0].indexOf(name),p=project(i,'grant-'+start,name,null,name,off);p.projectCode=null;p.evaluatedFiscalYear=years[0];p.evidence.push(evidence(i,raw,start));p.warnings.push('交付対象事業単位の実績検証。冊子表紙年ではなく各票の実績年度を使用。内訳事業との二重計上や、交付決定額を実績額とする推測を避け、名称・年度のみ収録。');r.projects.push(p);r.units.push({start,name,status:'supported',reason:'Unique explicit actual year and bounded evaluated grant title'});
 }
 return r;
}
function yufu(i:CachedInput):LayoutReview{
 const header='［令和７年度］',r:LayoutReview={projects:[],units:[],status:'reviewed_reform_items',reason:'Named administrative-reform action sheets; subordinate indicators not promoted and no shared scores/figures inferred.',proofs:[header,'大分県由布市']};
 if(i.truncated||i.format!=='pdf'||!i.text.includes(header)||!i.text.includes('大分県由布市'))return r;
 const hs=[...i.text.matchAll(/^([^\n［●・≪][^\n［]{1,89}) ［([^\n]*課[^\n]*)］$/gm)];
 for(let n=0;n<hs.length;n++){
 const h=hs[n],start=h.index!,raw=i.text.slice(start,hs[n+1]?.index??i.text.length);
 if(!raw.includes('実施状況')||!raw.includes('評価')){r.units.push({start,name:h[1],status:'held',reason:'Named reform item lacks independently bounded implementation/evaluation evidence'});continue;}
 const p=project(i,'reform-'+start,h[1],null,h[0],start);p.projectCode=null;p.evaluatedFiscalYear=2025;p.evidence.push(evidence(i,header,i.text.indexOf(header)),evidence(i,raw,start));p.warnings.push('令和７年度行財政改革の取組項目。通常の予算事業票とは区別し、下位の指標や内訳を別事業化しない。評価・金額は未収録。');r.projects.push(p);r.units.push({start,name:h[1],status:'supported',reason:'Named reform item with implementation/evaluation scope'});
 }return r;
}
