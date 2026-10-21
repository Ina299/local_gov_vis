import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
// Explicitly missing business numbers in the frozen baseline; existing records remain unchanged.
const missing=new Set('160 161 201 203 206 179 188 191 194 52 99 105 120 121 125 78 82 83 88 26 28 34 37 39 41 44 46 50 115 137'.split(' '));
export function extractMusashinoSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13203'||input.format!=='pdf')return [];
 if(input.sourceId==='77f611d5e25be3df7966848c')return extractSummary(input);
 const hs=[...input.text.matchAll(/^事務事業評価シート （評価対象年度：令和 7 年度）/gm)];const rows:ProjectEvaluation[]=[];
 for(let i=0;i<hs.length;i++){
  if(input.truncated&&i===hs.length-1)continue;
  const h=hs[i],raw=input.text.slice(h.index,hs[i+1]?.index??input.text.length);
  const m=raw.match(/事業名 ([^\n]+?) 所管課 ([^\n]+)\n業\nNo\.\n(\d+)/)??(()=>{const alt=raw.match(/事業名 ([^\n]+?) 業 (137)\n所管課 (環境政策課) No\./);if(alt)return [alt[0],alt[1],alt[3],alt[2]];if(raw.includes('多様な形での就労支援\n事\n事業名 健康福祉部生活福祉課・障害者福祉 業 115'))return ['', '多様な形での就労支援','','115'];return null;})();if(!m||!missing.has(m[3])||!raw.includes('■コスト'))continue;
  const p=project(input,m[3],m[1],null,raw,h.index);p.department=m[2]||null;p.evaluatedFiscalYear=2025;
  const result=raw.match(/■実績と成果\n([\s\S]+?)\n▶成果を示す/);if(result){p.outcomes=result[1];p.evidence.push(evidence(input,result[0],h.index+result.index!));}
  const header='区 分 令和5年度決算 令和6年度決算 令和7年度決算見込 令和8年度予算';const costs=raw.match(/^事 業 費 ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)$/m);
  if(raw.includes(header)&&costs){p.evidence.push(evidence(input,header,h.index+raw.indexOf(header)));for(const [col,year,kind] of [[1,2023,'actual'],[2,2024,'actual'],[4,2026,'budget']] as const)p.amounts.push({kind,fiscalYear:year,amountYen:Number(costs[col].replaceAll(',',''))*1000,rawValue:costs[col],rawUnit:'千円',evidence:evidence(input,costs[0],h.index+costs.index!)});}
  p.warnings.push('既存抽出に含まれない確定事業番号の詳細票を部分構造化。令和7年度決算見込は確定決算額に分類しない。実績と成果は原文保持し、複数行の指標値は未分離。対象年度のみ明示、評価実施年度は未確定。');rows.push(p);
 }
 return rows;
}

function extractSummary(input:CachedInput):ProjectEvaluation[]{
 const out:ProjectEvaluation[]=[];const excluded=new Set([220,222,223,224,227,229,230,231,232,233,234,239,246,249,259,263,278,282,294,296]);
 for(const m of input.text.matchAll(/^(\d+) (?:一般|国保|後期高齢|介護保険|水道事業|水 道 事 業|下水道事業) (?:[0-9*]+ [0-9*]+ [0-9*]+ )?([^\n]+?) ([○△×□](?: [○△×□]){0,3})(?: (変更なし|拡大|縮小|廃止|その他))?$/gm)){
  if(+m[1]<207||+m[1]>297||excluded.has(+m[1]))continue;
  const tokens=m[2].split(' ');if(tokens.length>2)continue;
  const name=tokens[0],dept=tokens[1];if(!name||/[（(][^）)]*$/.test(name))continue;
  const grades=m[3].split(' ');if(grades.length!==4&&!(+m[1]>=259&&grades.length===1))continue;
  const p=project(input,m[1],name,2026,m[0],m.index);p.evaluatedFiscalYear=2025;p.department=dept??null;
  const wrapped:Record<string,[string,string]>={'238':['生涯学習スポーツ課','生涯学習ス\n238 一般 10 06 01 一般管理経費 ○ ○ ○ ○ 変更なし\nポーツ課'],'286':['子ども子育て支援課','子ども子育て支援\n286 一般 03 02 03 一般管理経費 ○\n課']};
  const w=wrapped[m[1]];if(w&&input.text.includes(w[1])){p.department=w[0];p.evidence.push(evidence(input,w[1],input.text.indexOf(w[1])));}
  const labels=grades.length===1?['効率性']:['必要性','有効性','効率性','施策への貢献状況'];
  labels.forEach((label,i)=>p.ratings.push({kind:'self',label,value:grades[i],scale:null,evidence:evidence(input,m[0],m.index)}));
  if(m[4])p.ratings.push({kind:'self',label:'今後の方向性',value:m[4],scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('詳細票が保存されていないNo.207以降を結果概要の確定単行から部分構造化。別行に折り返された部署・方向性・事業名は推測しません。No.259以降は効率性だけの評価です。詳細費用・活動・成果は未取得。');out.push(p);
 }
 return out;
}
