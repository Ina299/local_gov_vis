import {miyazakiHolds} from './descending-miyazaki-holds';
import {miyazakiExtraRows} from './descending-miyazaki-extra-map';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
import {miyazakiRows} from './descending-miyazaki-map';
const holds:Record<string,{name:string;reason:string}[]>={
'dd643595eecc5502595ef49d':[
{name:'電力・ガス・食料品等価格高騰重点支援給付金（追加給付）',reason:'Explicit R5/R6 cumulative payments, R6 plan funding and carryover: tax year is not execution fiscal year; annual identity unresolved.'},
{name:'物価高騰対応重点支援給付金事業（給付金・定額減税一体支援）',reason:'Multiple tax-year cohorts and cumulative R5/R6 payments; no separate annual implementation scope assigned.'},
{name:'物価高騰対応重点支援給付金事業（住民税非課税世帯給付金）',reason:'R7.2–R8.1 spans execution fiscal years; R6 plan label does not determine actual annual identity.'},
{name:'美郷町肉用牛飼料価格高騰緊急対策事業',reason:'R5.12–R6.4 spans fiscal years; R8 outcome observations cannot establish a unique annual execution record.'}],
'07852c145c1415321fd8a176':[{name:'しいば復活応援商品券 TSUKO-TE給付事業',reason:'R5.12.21–R6.10.31 crosses fiscal years2023/2024. No explicit evaluation year; do not substitute grant allocation year.'}],
'53951ff0d0b0b0883c8fcb12':[{name:'row10',reason:'Explicit source statement №9と№10は同事業; one food-service project retained, funding split not duplicated.'},{name:'row20',reason:'Floating printed20 after medical equipment outcomes; no independent name cell. Do not infer a new project from row numbering alone.'}]
};
export function reviewMiyazakiR2(input:CachedInput,inputs:CachedInput[]=[]):LayoutReview|null{
 const held=miyazakiHolds.find(x=>x.id===input.sourceId&&x.code===input.municipalityCode);
 if(held){const valid=!input.truncated&&input.text.startsWith(held.proof);return{projects:[],units:[{start:0,status:valid?held.status:'source_identity_hold',reason:valid?held.reason:'Complete reviewed literal source is unavailable'}],status:valid?held.status:'source_identity_hold',reason:valid?held.reason:'Complete reviewed literal source is unavailable',proofs:[held.proof]};}
 const extra=miyazakiExtraRows.filter(x=>x.id===input.sourceId&&x.code===input.municipalityCode);
 if(extra.length){
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_units',reason:'Source-bound complete named units; annual identity checked independently of numeric columns',proofs:[extra[0].year]};
 if(input.truncated||input.format!=='pdf')return r;
 for(const row of extra){const yearSource=row.page?inputs.find(x=>x.sourceId===row.page&&x.municipalityCode===input.municipalityCode&&x.format==='html'&&!x.truncated):input;
 if(!yearSource||!yearSource.text.includes(row.year)||input.text.slice(row.start,row.start+row.raw.length)!==row.raw){r.units.push({start:row.start,name:row.name,status:'held',reason:'Exact title or explicit annual source association missing'});continue;}
 const p=project(input,'literal-extra-'+row.start,row.name,row.ey,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.fy;p.evidence.push(evidence(yearSource,row.year));p.warnings.push('原典の名称欄と明示年度のみ。三股町は平成25年度外部評価で実施年度は未確定。延岡市は令和3年度充当事業を保持し、翌年度を含む成果数値は未収録。新富町の対象年度は独立にハッシュ検証した保存済み公式案内本文に基づく。金額・評点・構成事業の推測分割はしない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Exact source title with explicit evaluation or execution year'});}
 if(input.sourceId==='47e18fa11ed899c6ec52d12b')r.units.push({start:0,name:'rows3/4 and7/8',status:'duplicate_component',reason:'Same named annual projects repeated for initial/supplementary budget components; not duplicated'},{start:0,name:'延岡市中小企業等応援給付事業',status:'annual_identity_hold',reason:'Row14 crosses R4.3–R4.5; allocation year is not a unique execution fiscal year. No evaluation date established.'});
 return r;
 }
 const rows=miyazakiRows.filter(x=>x.id===input.sourceId&&x.code===input.municipalityCode);if(!rows.length)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_grant_names',reason:'Reviewed individual grant implementation titles; annual scope kept separate from cumulative/carryover benefits. No financial or rating alignment inferred.',proofs:[rows[0].year]};
 if(input.truncated||input.format!=='pdf'||!input.text.includes(rows[0].year)){r.status='annual_identity_hold';r.reason='Complete annual source and literal year required';return r;}
 for(const row of rows){if(input.text.slice(row.start,row.start+row.raw.length)!==row.raw){r.units.push({start:row.start,name:row.name,status:'held',reason:'Reviewed name offset/literal differs'});continue;}
 const p=project(input,'miyazaki-title-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.fy;p.evidence.push(evidence(input,row.year));p.warnings.push('原典の個別事業名欄と明示年度のみ。折返し名称の対応を確認し、左右に分離した決算・交付金・実績・評価値は転記しない。複数年度累計・年度をまたぐ事業は別に保留。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Reviewed literal title and explicit fiscal scope'});}
 for(const h of holds[input.sourceId]??[])r.units.push({start:0,name:h.name,status:h.name==='row10'?'duplicate_component':'annual_identity_hold',reason:h.reason});return r;
}
