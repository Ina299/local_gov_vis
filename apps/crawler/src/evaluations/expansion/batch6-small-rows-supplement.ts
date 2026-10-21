import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractBatch6SmallRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='pdf')return [];const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='01460'&&input.sourceId==='f52145c4e49482d2462be427'){
  for(const m of input.text.matchAll(/^(\d+) (\S+課) (\S+班) (\S+) (\S+) R6 ([AB]) ([AB]) ([AB])[^\n]*/gm)){
   const p=project(input,m[1],m[5],2024,m[0],m.index);p.department=m[2]+' '+m[3];
   ['必要性','効率性','公平性'].forEach((label,i)=>p.ratings.push({kind:'self',label:`２次評価 ${label}`,value:m[6+i],scale:null,evidence:evidence(input,m[0],m.index)}));
   p.warnings.push('結果一覧の確定単行のみ部分構造化。前後行に折り返された方向性・指示事項や複数行の名称/部署は未抽出。対象年度は推測しない。');out.push(p);
  }
 }else if(input.municipalityCode==='11216'&&input.sourceId==='f692f851bb948fd540aaaafe'){
  let label:string|null=null,department:string|null=null,offset=0,labelStart=0;
  for(const line of input.text.split('\n')){const start=offset;offset+=line.length+1;const before:string|null=label;
   if(line==='④ 事業中止')label='事業中止';else if(line==='⑤ 類似事業との統合')label='類似事業との統合';
   else if(line.includes('全体の見直しが必要と評価した主な事業'))label='実施内容：全体の見直しが必要';
   else if(line.includes('一部改善の余地ありと評価した主な事業'))label='実施内容：一部改善の余地あり';
   else if(line==='① 拡大の方向性を示した主な事業')label='事業規模：拡大';
   else if(line==='② 縮小の方向性を示した主な事業')label='事業規模：縮小';
   else if(line==='① 増額の方向性を示した主な事業')label='予算：増額';
   else if(line==='② 減額の方向性を示した主な事業')label='予算：減額';
   else if(line==='廃止の方向性を示した主な事業')label='事業廃止';
   if(label!==before)labelStart=start;
   const dept=line.match(/^【([^】]+)】$/);if(dept)department=dept[1];
   const m=line.match(/^([A-C]-[０-９0-9]+) ([^【]+?)(?:【([^】]+)】(?: .*)?)?$/);if(!m||!label)continue;
   const p=project(input,m[1].normalize('NFKC'),m[2],2025,line,start);p.department=m[3]??department;
   p.ratings.push({kind:'self',label:'総点検で示された方向性',value:label,scale:null,evidence:evidence(input,input.text.slice(labelStart,start+line.length),labelStart)});
   p.warnings.push('総点検概要に個別事業名・コードとともに示された方向性を部分抽出。全538事業の個票ではありません。予算の増減方向と効果見込額を決算/予算額へ転用していません。');out.push(p);
  }
 }
 return out;
}
