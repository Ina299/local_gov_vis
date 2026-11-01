import {createHash} from 'node:crypto';
import {munakataBounded} from './descending-munakata-bounded-map';
import {type CachedInput,project,evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
export function boundedMunakataScope(i:CachedInput){
 const c=munakataBounded.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);
 if(!c||!i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.startsWith(c.proof+'\n'))return null;
 for(const [n,row]of c.rows.entries()){
  const body=i.text.slice(row.start,row.end),after=i.text.slice(row.end);
  if(!body.startsWith(row.name+' ■事業概要■')||!body.includes('■実績・成果■')||!body.includes('決算書')||!body.includes('事業費（千円）')||!(n<c.rows.length-1?after.startsWith(c.rows[n+1].name+' ■事業概要■'):after.startsWith('その他の決算額')))return null;
 }
 return c;
}
export function reviewBoundedMunakata(i:CachedInput):LayoutReview|null{
 if(!munakataBounded.some(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode))return null;
 const c=boundedMunakataScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Complete annual named result blocks inside the pinned prefix; appendix remains incomplete.'};
 if(!c){r.status='source_integrity_hold';r.reason='Source identity, prefix hash or named result boundary differs';return r;}
 for(const row of c.rows){const p=project(i,'bounded-result-'+row.start,row.name,null,row.name,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,c.proof,0),evidence(i,i.text.slice(row.start,row.end),row.start));p.warnings.push('途中で切れた決算資料のうち、次の事業見出し又はその他決算額見出しまで揃う個別実績欄のみ。決算前年度・当年度・増減を混同せず金額未抽出。政策・統計資料は追加事業にしない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit annual report title and bounded named result block'});}
 r.units.push({start:i.text.length,status:'missing_body_hold',reason:`Cached ${c.exportedCharacters}/${c.originalCharacters} characters; statistical appendix cut and no listed continuation. Not a current access denial.`});r.proofs=[c.proof];return r;
}
