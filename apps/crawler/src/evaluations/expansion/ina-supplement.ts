import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** Individually named business sections in an education report; not policy grades. */
export function extractInaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11301'||input.sourceId!=='ebcbb06ce4bc11a4b207d4a6'||input.format!=='pdf'||!input.text.includes('（令和６年度対象）'))return [];
 const first=input.text.indexOf('【事務事業の評価・課題】');if(first<0)return [];
 const heads=[...input.text.matchAll(/^([^\s、。]+(?:事業|事務費))(?= |$)/gm)].filter(m=>m.index>first);
 const rows=new Map<string,ProjectEvaluation>();
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const h=heads[i],tail=input.text.slice(h.index,heads[i+1]?.index??input.text.length);
  const department=tail.match(/【([^\n【】]+課)】/),mark=tail.indexOf('【学識経験者の意見等】');
  if(!department||mark<0||department.index!>mark||department.index!>600)continue;
  const opinion=tail.slice(mark).match(/^【学識経験者の意見等】\n(・[^。]+。)/);
  if(!opinion||opinion[1].includes('【')||opinion[1].includes('\n・'))continue;
  const key=`${h[1]}:${department[1]}`;
  const p=rows.get(key)??project(input,key,h[1],2025,h[0],h.index);
  p.department=department[1];p.evaluatedFiscalYear=2024;
  p.evidence.push(evidence(input,department[0],h.index+department.index!),evidence(input,opinion[0],h.index+mark));
  p.ratings.push({kind:'external',label:'学識経験者意見（先頭の完結した一文）',value:opinion[1],scale:null,evidence:evidence(input,opinion[1],h.index+mark+opinion[0].indexOf(opinion[1]))});
  if(!rows.has(key)){
   p.evidence.push(evidence(input,'（令和６年度対象）'));
   p.warnings.push('事業別詳細節から名称・部署・学識経験者意見の先頭の完結した一文のみ部分抽出。施策評価の評点は転用しません。費用・成果・意見全文は横方向の列混在があり未抽出。折返し事業名は未抽出。同名同部署の再掲節は同一レコードに証拠を統合。');rows.set(key,p);
  }
 }
 return [...rows.values()];
}
