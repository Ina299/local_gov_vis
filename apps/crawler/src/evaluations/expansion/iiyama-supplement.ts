import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractIiyamaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='20213'||input.sourceId!=='62b0edf529be9aa26e70329e')return [];
 const header='令和６（2024）年11月１日（金）';if(!input.text.includes(header))return [];
 const out=new Map<string,ProjectEvaluation>();
 for(const s of input.text.matchAll(/5 施策に関連する事務事業[^]*?(?=施策に関連する主な個別計画)/g)){
  // Each token tuple is complete on one line, including either half of a two-column table.
  for(const m of s[0].matchAll(/(?:^| )([^\s]+) ([^\s]+(?:課|局|センター)) ([\d,]+) (継続|拡充|縮小|廃止|改善|統合)(?= |$)/gm)){
   const raw=m[0].trimStart(),start=s.index!+m.index!+m[0].length-raw.length;
   const key=m[1]+'|'+m[2];const old=out.get(key);
   if(old){if(!old.evidence.some(e=>e.cell===evidence(input,raw,start).cell))old.evidence.push(evidence(input,raw,start));continue;}
   const p=project(input,key,m[1],2024,raw,start);p.department=m[2];p.evidence.push(evidence(input,header));
   p.ratings.push({kind:'self',label:'事務事業評価',value:m[4],scale:null,evidence:evidence(input,raw,start)});
   p.warnings.push('施策に関連する下位事務事業の一覧。同名同課の再掲は証拠を統合。金額単位・対象年度・予算決算区分が表内で確定しないため金額と対象年度は未数値化。上位施策の指標・達成度は付与しない。');out.set(key,p);
  }
 }
 for(const s of input.text.matchAll(/5 施策に関連する事務事業[^]*?(?=施策に関連する主な個別計画)/g)){
  for(const m of s[0].matchAll(/(?:^| )([^\s]+) ([^\s]+(?:課|局|センター))(?= |$)/gm)){
   if(m[1]==='事務事業名')continue;const key=m[1]+'|'+m[2];if(out.has(key))continue;
   const raw=m[0].trimStart(),start=s.index!+m.index!+m[0].length-raw.length;
   const p=project(input,key,m[1],2024,raw,start);p.department=m[2];p.evidence.push(evidence(input,header));p.warnings.push('下位事務事業の名称・担当のみ確定。事業費・評価欄が未掲載または折返しのため未割当。上位施策の実績を付与しない。');out.set(key,p);
  }
 }
 return [...out.values()];
}
