import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const YEARS:Record<string,number>={'2524d3278cda917233ac9c1a':2022,'6638833a2577be37ab9a2b6f':2023,'8f1d6b84839572de02644ed3':2024,'364081d7f0e850ace7c55190':2025};
export function extractYokoshibahikariListSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=YEARS[input.sourceId];if(input.municipalityCode!=='12410'||!year||input.truncated||input.format!=='pdf')return[];
 const result:ProjectEvaluation[]=[];
 // Only row-local complete names ending in a business noun; wrapped column text is not joined.
 for(const m of input.text.matchAll(/^(\d+) (\d+) ([1-9]) (\d+) (\d+) ([①-⑳]+) (\S+) (\S+) (\S+) (?:[^\n]*? )?([Ａ-ＥA-E])$/gm)){
  if(!/(?:事業|補助金|負担金|助成金|委託料)$/.test(m[9]))continue;
  const p=project(input,`list-${year}-${m[3]}-${m[1]}-page${m[2]}`,m[9],year,m[0],m.index!);p.department=m[7]+' '+m[8];
  const h=input.text.slice(0,input.text.indexOf('頁 名 名')+7);p.evidence.push(evidence(input,h,0));
  p.ratings.push({kind:'self',label:'今後の方針',value:m[10],scale:'A：拡充 B：現状維持 C：見直し D：休廃止 E：その他',evidence:evidence(input,m[0],m.index!)});
  p.warnings.push('事務事業評価一覧で名称・方針が単行に完結した行のみ部分構造化。概要列の混線、折返し名称、年度別対象実績と経費は推測していません。同じR7表記の別PDFは相違・再掲確認未了のため未採用。');result.push(p);
 }
 return result;
}
