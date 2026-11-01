import type {LayoutReview} from './descending-layouts-r2';
import {southernRows} from './descending-south-literal-map';
import {type CachedInput,evidence,project} from './shared';
export function reviewSouthernLiterals(i:CachedInput):LayoutReview|null{
 const rows=southernRows.filter(r=>r.sourceId===i.sourceId&&r.code===i.municipalityCode);if(!rows.length||i.format!=='pdf')return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_business_rows',reason:'Named business units and independent explicit period evidence; no numerical alignment inferred',proofs:[]};
 if(i.truncated){r.status='missing_complete_body';r.reason='Complete source required';return r;}
 for(const row of rows){const u={start:row.start,name:row.name,status:'held',reason:'Exact reviewed title/period evidence differs'};r.units.push(u);if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||i.text.slice(row.yearStart,row.yearStart+row.yearProof.length)!==row.yearProof)continue;
  const p=project(i,'literal-'+row.start+'-'+(row.fy??row.ey),row.name,row.ey,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.fy;p.evidence.push(evidence(i,row.yearProof,row.yearStart));p.warnings.push('名称欄と明示年度を原文位置で個別確認。評価年度と実施年度を区別し、将来予算・複数年度の金額・不明な列対応を数値に補わない。');if(i.municipalityCode==='46217')p.warnings.push('繰越を含む冊子のうち、個別始終期が令和4年度内と確認できる事業のみ。車両導入と翌年度以降の実稼働は区別。');r.projects.push(p);u.status='supported';u.reason='Literal business identity and explicit fiscal/evaluation period';
 }
 if(i.sourceId==='dc1e52d8150c2daa44e8f73d'){
  for(const [name,reason]of [['新型コロナウイルス傷病見舞金','End date displaced below the next row; cannot safely align an execution year from the mixed-year title alone'],['酪農経営緊急支援対策事業','Dates displaced below other rows; original date-column association required'],['曽於市中小企業事業継続支援金（第４期）','R5.3.20–R5.7.28 crosses fiscal years'],['養豚経営緊急支援事業給付金','R5.3.29–R5.5.19 crosses fiscal years'],['養鶏経営緊急支援事業給付金','R5.3.15–R5.5.19 crosses fiscal years'],['酪農経営支援対策事業（延長・拡充）','R5.3.29–R5.5.19 crosses fiscal years']])r.units.push({start:0,name,status:'annual_identity_hold',reason:reason+'; no evaluation year is explicitly dated. Keep out of annual candidates.'});
 }
 if(i.sourceId==='f8647590bcd6288307647afd')r.units.push({start:i.text.indexOf('航空写真撮影及び写真地図作成業務'),name:'航空写真撮影及び写真地図作成業務',status:'annual_identity_hold',reason:'2025 direction says not executed in2025; no explicit target/results year on this sheet. Do not infer2024 by subtracting one.'});
 r.proofs=[...new Set(rows.map(r=>r.yearProof))];return r;
}
