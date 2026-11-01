import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
import {bungoKpiRows} from './descending-bungotakada-kpi-map';
export function reviewBungoKpi(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode!=='44209')return null;const c=bungoKpiRows.find(c=>c.id===i.sourceId);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_named_kpi_activities',reason:'Explicitly named operational rows only, with annual actual-column labels; policy headings, shared KPI values and numeric alignment are not converted.',proofs:c.proofs};
 if(i.truncated||i.format!=='pdf'||createHash('sha256').update(i.text).digest('hex')!==c.fullTextSha256||!c.proofs.every(p=>i.text.includes(p))){r.status='source_integrity_hold';r.reason='Expected complete PDF text hash or exact annual proof is absent; no mapped activity may be emitted.';return r;}
 for(const row of c.rows){
  if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw)continue;
  if(row.name.includes('地域サロンに派遣する運動推進員')){r.units.push({start:row.start,name:row.name,status:'individual_identity_hold',reason:'Quoted 「地域で健康づくり」応援事業 already occurs in grant records. Training activity versus whole grant scope must be reconciled before adding another annual identity.'});continue;}
  for(let n=0;n<c.years.length;n++){
   const p=project(i,'kpi-activity-'+row.start+'-'+c.years[n],row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.years[n];p.evidence.push(evidence(i,c.proofs[n],i.text.indexOf(c.proofs[n])));p.warnings.push('活動指標表の明記された実施項目名と実績欄年度のみ。予算事業との同一性・実施完了を推測せず、共通KPIや隣接する数値を転記しない。');r.projects.push(p);
  }
  r.units.push({start:row.start,name:row.name,status:'supported',reason:row.repeatCount>1?'Repeated identical activity in policy contexts emitted once per explicit annual column.':'Exact named activity, no policy heading or invented financial association.'});
 }
 const selected=new Set(c.rows.map(x=>x.name));
 for(const m of i.text.matchAll(/^[①-⑳][^\n]+/gm))if(!selected.has(m[0].slice(1)))r.units.push({start:m.index!,name:m[0],status:'layout_review',reason:'Unmapped policy/action or indicator row; distinguish individual operational identity from a policy or shared outcome before extracting. Not missing input or an access hold.'});
 return r;
}
