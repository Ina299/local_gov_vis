import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
import {bungoRows} from './descending-bungotakada-map';
export function reviewBungotakada(i:CachedInput,inputs:CachedInput[]):LayoutReview|null{
 if(i.municipalityCode!=='44209')return null;
 const c=bungoRows.find(c=>c.id===i.sourceId);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_grant_titles',reason:'Reviewed exact grant title fragments with explicit annual scope; no inferred amounts, ratings or row-to-column allocation.',proofs:[c.proof]};
 if(i.truncated||i.format!=='pdf'||!i.text.includes(c.proof))return r;
 const page=inputs.find(p=>p.municipalityCode===i.municipalityCode&&p.sourceId==='6cc80f44c4fd30315a7c5812'&&p.format==='html'&&!p.truncated);
 if(c.pageProof&&(!page||!page.text.includes(c.pageProof))){r.status='annual_identity_hold';r.reason='Exact saved official landing-page annual link label missing';return r;}
 for(const row of c.rows){if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||!i.text.includes(row.yearProof)){r.units.push({start:row.start,name:row.name,status:'held',reason:'Reviewed literal title span changed'});continue;}
 const p=project(i,'grant-literal-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;if(row.yearProof!==c.proof)p.evidence.push(evidence(i,row.yearProof,i.text.indexOf(row.yearProof)));p.evidence.push(evidence(i,c.proof,i.text.indexOf(c.proof)));if(c.pageProof&&page)p.evidence.push(evidence(page,c.pageProof,page.text.indexOf(c.pageProof)));p.warnings.push('交付対象事業名と報告対象年度のみ。折返し・隣接列の説明文は確認済み文字範囲を引用し、数値や共通評価を転記しない。繰越・過年度経費の執行年度を推測しない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Exact reviewed name and annual report evidence'});}
 for(const h of c.held)r.units.push({start:0,name:h.name,status:h.name.includes('二頁再掲')?'duplicate_component':'annual_identity_hold',reason:h.reason});return r;
}
