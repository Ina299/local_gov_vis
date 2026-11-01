import {createHash} from 'node:crypto';
import {fukutsuBounded} from './descending-fukutsu-bounded-map';
import {type CachedInput, project, evidence} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
/** Explicitly approved prefix only. This never claims the underlying book is complete. */
export function boundedFukutsuScope(i:CachedInput){
 const c=fukutsuBounded.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);
 if(!c||!i.truncated||i.format!=='pdf'||i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||[...i.text].length!==c.exportedCharacters||createHash('sha256').update(i.text).digest('hex')!==c.prefixSha256||!i.text.startsWith(c.proof))return null;
 for(const [n,row]of c.rows.entries()){
  const body=i.text.slice(row.start,row.end),before=i.text.slice(0,row.start);
  if(row.page!==n+8||!before.endsWith(`-${row.page-1}-\n`)||!body.startsWith(row.name)||!/^.+[ \n]単位：円\n大事業 /.test(body)||!body.trimEnd().endsWith(`-${row.page}-`)||!body.includes('事業費の内訳')||!body.includes('事業の内容')||(c.year===2024?!body.includes('【事後】成果')||!body.includes('【事後】課題')||!body.includes('課題に対する改善・改革案'):!body.includes('事業実施後の成果等')||!body.includes('事業の目的・背景')))return null;
 }
 return c;
}
export function reviewBoundedFukutsu(i:CachedInput):LayoutReview|null{
 if(!fukutsuBounded.some(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode))return null;
 const c=boundedFukutsuScope(i),r:LayoutReview={projects:[],units:[],proofs:[],status:'incomplete_body_hold',reason:'Only complete individual pages inside a hash-verified cached prefix; missing tail stays held.'};
 if(!c){r.status='source_integrity_hold';r.reason='Pinned prefix identity/hash, truncated status or complete sheet boundary differs';return r;}
 for(const row of c.rows){
  const p=project(i,'bounded-page-'+row.page,row.name,null,row.name,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;
  p.evidence.push(evidence(i,c.proof,0),evidence(i,i.text.slice(row.start,row.end),row.start));
  p.warnings.push('保存済み途中本文のうちページ末尾まで完結した個別票のみ。全文取得済みではない。原PDF座標は未復元。予算・決算・財源・KPIの列位置を推測せず数値は未抽出。');
  r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit annual report and complete individually bounded page '+row.page});
 }
 r.units.push(...c.holds.map(h=>({start:c.rows[c.rows.length-1].end,name:h.name,status:'incomplete_body_hold',reason:h.reason})));r.units.push({start:i.text.length,status:'missing_body_hold',reason:`Only ${c.exportedCharacters} of ${c.originalCharacters} recorded characters are cached, with no listed continuation. Later table-of-contents titles are not project records.`});r.proofs=[c.proof];return r;
}
