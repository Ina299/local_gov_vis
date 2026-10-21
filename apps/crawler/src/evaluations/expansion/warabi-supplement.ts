import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const names=['広報紙発行事業','ファミリーサポート事業','母子厚生保障年金給付費','介護保険利用助成事業','配食サービス事業','特定保健指導事業','乳幼児健診事業','産後ケア事業','住宅等耐震化事業','公園等管理費','消防団員活動費'];
export function extractWarabiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11223'||input.sourceId!=='bbf0fcddac731b4224a9c459'||input.format!=='pdf')return [];
 const out:ProjectEvaluation[]=[];
 for(const name of names){
  const start=input.text.indexOf(name);if(start<0)continue;
  const rest=input.text.slice(start);const cost=rest.match(/【令和６年度決算額 ([０-９，]+)円】/);if(!cost)continue;
  const raw=rest.slice(0,cost.index!+cost[0].length);const dept=raw.match(/【([^】]+(?:課|センター|本部))】/);
  const p=project(input,name,name,2025,raw,start);p.evaluatedFiscalYear=2024;p.department=dept?.[1]??null;
  p.amounts.push({kind:'actual',fiscalYear:2024,amountYen:Number(cost[1].normalize('NFKC').replaceAll(',','')),rawValue:cost[1],rawUnit:'円',evidence:evidence(input,cost[0],start+cost.index!)});
  p.warnings.push('行政評価概要の独立事業名と明示決算額を部分構造化。事業概要と委員意見が横並びで混在するため、文章を成果や評価値に推測分離していません。折返し名称7事業は未抽出。');out.push(p);
 }
 return out;
}
