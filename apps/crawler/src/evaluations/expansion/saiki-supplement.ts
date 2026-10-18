import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const items = [
 ['①家庭ごみの有料戸別収集等の','家庭ごみの有料戸別収集等のあり方検討','あり方検討'],
 ['②エコセンター番匠ごみ搬入窓','エコセンター番匠ごみ搬入窓口業務の民間委託','口業務の民間委託'],
 ['③食のまちづくり推進事業の民','食のまちづくり推進事業の民間委託','間委託'],
 ['④ふるさと納税事務の民間委託','ふるさと納税事務の民間委託',''],
 ['⑤地域包括支援センターの民間','地域包括支援センターの民間委託','委託'],
 ['⑥下水道施設の包括的民間委託','下水道施設の包括的民間委託',''],
];
export function extractSaikiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='44205'||input.sourceId!=='3bae0e4e11976342bc149892'||input.format!=='pdf')return [];
 const out:ProjectEvaluation[]=[];
 for(let i=0;i<items.length;i++){
  const [begin,name,fold]=items[i];const start=input.text.indexOf(begin+' 【現状・課題】');if(start<0)continue;
  const end=input.text.indexOf(i+1<items.length?items[i+1][0]:'⑦ＰＰＰ/ＰＦＩ',start);if(end<0)continue;
  const raw=input.text.slice(start,end);if(fold&&!raw.split('\n')[1]?.startsWith(fold+' '))continue;
  const rating=raw.match(/≪(達成|未達成)≫/);const dept=raw.match(/【([^【】\n]+課)】/);if(!rating||!dept)continue;
  const p=project(input,name,name,null,raw,start);p.department=dept[1];
  p.ratings.push({kind:'self',label:'令和2～6年度の個別業務改革の検証',value:rating[1],scale:null,evidence:evidence(input,raw.slice(0,rating.index!+rating[0].length),start)});
  p.warnings.push('行政経営推進プラン資料編の個別業務改革6項目の名称・担当課・達成判定のみを部分構造化。通常の予算事業個票ではなく、民間委託等の改革検証。期間は令和2～6年度で単年度評価に換算していません。現状・実施内容・成果が横並び混在するため金額・成果数値を分離していません。');out.push(p);
 }
 return out;
}
