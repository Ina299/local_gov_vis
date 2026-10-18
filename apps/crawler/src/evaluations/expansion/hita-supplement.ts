import {createHash} from 'node:crypto';
import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const ids=new Set(['1dff53df9f4ed971d2f49b2f','db9ddf7217f0f3f3276419a9']);
export function extractHitaSupplement(input:CachedInput,inputs:CachedInput[]=[input]):ProjectEvaluation[]{
 if(input.municipalityCode!=='44204'||!ids.has(input.sourceId))return [];
 const merged=new Map<string,{owner:string,record:ProjectEvaluation}>();
 for(const source of [...inputs].sort((a,b)=>a.sourceId.localeCompare(b.sourceId))){
  if(source.municipalityCode!=='44204'||!ids.has(source.sourceId)||source.format!=='pdf')continue;
  const heads=[...source.text.matchAll(/^平成26年度 施策（主要施策） 評価シート$/gm)];
  for(let i=0;i<heads.length;i++){
   const begin=heads[i].index;const sec=source.text.slice(begin,heads[i+1]?.index??source.text.length);
   const dept=sec.match(/^担当部課 (.+)$/m);const start=sec.indexOf('■主な事務事業');const end=sec.indexOf('■コスト',start);
   if(!dept||start<0||end<0)continue;
   const block=sec.slice(start,end);const lines=[...block.matchAll(/^.*$/gm)];
   for(let k=0;k<lines.length;k++){
    const line=lines[k][0];const m=line.match(/^([^\s]+(?:事業|費|補助金|負担金|助成金|相談会|事務)) (.*) ([ABCD]) (拡 充|現行どおり|見直しが必要|廃 止)$/);
    if(!m||m[1]==='教育振興事業')continue;
    const inline=/^H\d+ /.test(m[2]);const wrapped=lines[k-1]?.[0]==='H17'&&lines[k+1]?.[0]==='以前';
    if(!inline&&!wrapped)continue;
    const key=`2014\n${dept[1]}\n${m[1]}`;const offset=begin+start+lines[k].index!;
    const proof=evidence(source,line,offset);const old=merged.get(key);
    if(old){old.record.evidence.push(proof);for(const [label,value] of [['施策への貢献度',m[3]],['今後の方向性',m[4]]])old.record.ratings.push({kind:'self',label,value,scale:null,evidence:proof});continue;}
    const p=project(source,`business-2014-${createHash('sha256').update(key).digest('hex').slice(0,16)}`,m[1],null,line,offset);
    p.evaluatedFiscalYear=2014;p.department=dept[1];
    p.evidence.push(evidence(source,sec.slice(0,start),begin));
    for(const [label,value] of [['施策への貢献度',m[3]],['今後の方向性',m[4]]])p.ratings.push({kind:'self',label,value,scale:null,evidence:proof});
    p.warnings.push('平成26年度施策調書の下位事務事業表で名称・開始年度・評価が確定した行のみ部分構造化。開始年度は評価対象年度に転用せず、表題から対象2014年度を採用。評価実施年は未設定。主要施策の成果・指標を転用せず、決算欄の単位は下位表に明示されないため金額未数値化。同名同部署の再掲は証拠統合し、教育振興事業等の別費目混在は除外。');
    merged.set(key,{owner:source.sourceId,record:p});
   }
  }
 }
 return [...merged.values()].filter(x=>x.owner===input.sourceId).map(x=>x.record);
}
