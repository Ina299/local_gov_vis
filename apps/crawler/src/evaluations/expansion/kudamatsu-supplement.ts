import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const number=(s:string)=>Number(s.normalize('NFKC').replaceAll(',',''));
/** Earlier education evaluations; deliberately excludes the already imported R8 report. */
export function extractKudamatsuSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='35207'||input.format!=='pdf')return [];
 const year=input.text.match(/^令和([６７])年度（令和([５６])年度対象）\n事務事業評価報告書\n下松市教育委員会/);
 if(!year)return [];
 const heads=[...input.text.matchAll(/^事務事業評価シート ?【№([０-９]+)】\n/gm)];const rows:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const h=heads[i],start=h.index,raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
  const nameBlock=raw.slice(h[0].length,raw.indexOf('１ 事務事業の概要'));
  const single=nameBlock.match(/^事務事業 (.+) 担当課 (.+)\n$/);
  const wrapped=nameBlock.match(/^([^\n]+)\n事務事業 担当課 ([^\n]+)\n([^\n]+)\n$/);
  if(!single&&!wrapped)continue;
  const name=(single?.[1]??`${wrapped![1]}${wrapped![3]}`).replace(/^☆/,'');
  const ratings=raw.match(/妥当性 有効性 効率性 関与性 総合評価\n([Ａ-Ｄ]) ([Ａ-Ｄ]) ([Ａ-Ｄ]) ([Ａ-Ｄ]) (継続|拡充|縮小|完了|廃止(?:（休止）)?)\n/);
  if(!ratings||!raw.includes('事務事業の今後の課題'))continue;
  const p=project(input,String(number(h[1])),name,2018+number(year[1]),raw,start);
  p.evaluatedFiscalYear=2018+number(year[2]);p.department=single?.[2]??wrapped![2];
  p.evidence.push(evidence(input,year[0]));
  const overview=raw.match(/１ 事務事業の概要\n([\s\S]*?)２ 事務事業のコスト/);
  if(overview)p.activities=overview[1].trim();
  for(const [j,label] of ['妥当性','有効性','効率性','関与性','総合評価'].entries())p.ratings.push({kind:'self',label,value:ratings[j+1],scale:null,evidence:evidence(input,ratings[0],start+ratings.index!)});
  const costs=raw.match(/２ 事務事業のコスト 単位：千円\n予算 ([０-９，]+) 予算 ([０-９，]+) 予算 ([０-９，]+)\nＲ([０-９]+) Ｒ([０-９]+) Ｒ([０-９]+)\n/);
  if(costs)for(let j=1;j<=3;j++)p.amounts.push({kind:'budget',fiscalYear:2018+number(costs[j+3]),amountYen:number(costs[j])*1000,rawValue:costs[j],rawUnit:'千円',evidence:evidence(input,costs[0],start+costs.index!)});
  p.warnings.push('個票単位で構造化。概要は実施内容と将来計画が併記されるため成果には転用しない。決算・決算見込の列対応が混在する数値は未抽出。予算は年度と3列の対応が明示された欄のみ抽出。');
  rows.push(p);
 }
 return rows;
}
