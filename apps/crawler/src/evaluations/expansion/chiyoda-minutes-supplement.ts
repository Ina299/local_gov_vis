import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
interface Unit {id:string;name:string;start:string;end:string;department:string;extra?:[string,string]}
const reviewed:Record<string,Unit[]>={
 '2eaf1ba2e77c5ab348d74441':[{id:'employment-center',name:'障害者就労支援センター',start:'こういう障害者の中で、就労を希望されている方はどれぐらいいるの',end:'あとは、ほかの自治体であれば、',department:'保健福祉部',extra:['松井委員 はい。２つ目です。計画上の目標が、障害者就労支援センターの事業','松井委員 補足です。']}],
 '72f204f07a30ea52014c4360':[
 {id:'green-stock',name:'グリーンストック作戦',start:'夏目環境政策課長 まず、既築建築物に対しての取組みなんですが、',end:'それから、新築建築物の執行率が低いということですが、',department:'環境政策課'},
 {id:'low-carbon-building',name:'低炭素建築物助成',start:'それから、新築建築物の執行率が低いということですが、',end:'松井委員 ありがとうございます。この指標の１つ目に関して言うと、',department:'環境政策課'},
 ],
};
export function extractChiyodaMinutesSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13101'||input.format!=='pdf'||input.truncated||!reviewed[input.sourceId])return [];
 const header=/^令和元年度第[１２12]回千代田区行政評価委員会 議事録/.exec(input.text)?.[0];if(!header)return [];
 return reviewed[input.sourceId].map(unit=>{
  const start=input.text.indexOf(unit.start),end=input.text.indexOf(unit.end,start+unit.start.length);
  if(start<0||end<start)throw new Error(`Reviewed Chiyoda statement changed: ${unit.id}`);
  const raw=input.text.slice(start,end),p=project(input,unit.id,unit.name,2019,raw,start);p.department=unit.department;
  p.outcomes=raw;p.evidence.push(evidence(input,header,0));
  if(unit.extra){const a=input.text.indexOf(unit.extra[0]),b=input.text.indexOf(unit.extra[1],a+unit.extra[0].length);if(a<0||b<a)throw new Error('Reviewed Chiyoda opinion changed');p.evidence.push(evidence(input,input.text.slice(a,b),a));}
  p.warnings.push('行政評価委員会議事録の事業別言及を部分構造化したもので、事務事業評価個票ではない。施策全体の評価や第三者の確定評点をこの事業に転用しない。成果欄は行政側の実施説明原文で、提言や制度説明も併記される。実績の対象年度は未確定で、会議年・昨年度という相対表現から費用年度を補わない。助成上限・補助率・支出額・登録人数を確定実績数値へ分離していない。');
  return p;
 });
}
