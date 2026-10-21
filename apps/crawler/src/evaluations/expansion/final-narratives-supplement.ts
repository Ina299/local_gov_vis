import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Narrow, source-bound narrative units; policy totals and forecast values stay in the original. */
export function extractFinalNarrativesSupplement(input: CachedInput): ProjectEvaluation[] {
 if(input.truncated)return [];
 const text=input.text;
 if(input.municipalityCode==='08220'&&input.sourceId==='e3876599cce1374b361fad00'){
  const name='（仮称）つくば市茎崎給食レストラン整備事業';
  if(!text.includes('（仮称）つくば市茎崎給食\nレストラン整備事業')||!text.includes('令和８年（2026 年）7 月 10 日'))return [];
  const p=project(input,name,name,2026,text);p.department='教育局健康教育課';
  const value='検討・整理を要する事項が複数ある。';
  p.ratings.push({kind:'external',label:'大規模事業事前評価・総合所見',value,scale:null,evidence:evidence(input,value)});
  for(const label of ['事業の必要性','事業の妥当性','事業の優先性','事業の有効性','事業の経済性・効率性','地域への対応']){
   const start=text.indexOf(`${label}について、市の評価`);if(start<0)continue;const end=text.indexOf('。',start);if(end<0)continue;const raw=text.slice(start,end+1);
   p.ratings.push({kind:'external',label:`事前評価・${label}`,value:raw.replace(/\n/g,''),scale:null,evidence:evidence(input,raw,start)});
  }
  p.warnings.push('事業実施前の大規模事業評価。整備後の成果ではない。複数機能を別事業に増分しない。提供予定食数・来店者予測・将来比率は実績指標に転記しない。');return [p];
 }
 const specs:Record<string,[string,string,string][]>={
  '907c1a99fc53dd5e786da3a2':[['月イチ園むすび／むらふぇす事業','月イチ園むすびや、むらふぇす事業に協力する','村に住まう人たちが']],
  'db45972c8cc15ecc2a5c23a9':[['ふなはしあさイチ','令和３年度から実施したふなはしあさイチは','令和５年度には青空マルシェ'],['青空マルシェベジボート','令和５年度には青空マルシェ','令和４年度から実施している制服'],['制服等のリユース事業','令和４年度から実施している制服','制服等のリユース事業開始']],
  'de992f71df0169c28dbd0244':[['定住支援助成事業','令和４年度から開始した定住支援助成事業により','令和５年度地域再生大賞']],
  '4ba504844e6d7c2367ac9d61':[['市道整備事業（整備延長）','坂東市道については，整備が計画通り完了する','特別措置を適用して行'],['広域農道整備事業（整備延長）','他事業との調整に時間を要したため,','緊急車両等の運行困難解消及び歩道'],['生活道路整備事業','緊急車両等の運行困難解消及び歩道','将門まつりや千姫まつりなど地域の歴史に根ざ'],['観光・交流推進事業','将門まつりや千姫まつりなど地域の歴史に根ざ','その他の事業\n坂東市において'],['フィルムコミッション事業','坂東市において，シティプロモーション担当職員','坂東市において，圏央道の整備に向けた産業集積拠点'],['産業集積形成推進事業','坂東市において，圏央道の整備に向けた産業集積拠点','計画外で独自に実施し']],
 };
 const list=specs[input.sourceId];if(!list)return [];
 const joint=input.sourceId==='4ba504844e6d7c2367ac9d61';if(input.municipalityCode!==(joint?'08228':'16321'))return [];
 return list.flatMap(([name,begin,end])=>{const start=text.indexOf(begin);const stop=text.indexOf(end,start+begin.length);if(start<0||stop<0)return [];const raw=text.slice(start,stop).trim();const p=project(input,name,name,null,raw,start);p.activities=raw;
  if(joint){p.evidence.push(evidence(input,'事業実施主体 茨城県，常総市及び坂東市'));p.warnings.push('茨城県・常総市・坂東市の共同地域再生計画の事業別評価。記述全体を坂東市単独実績としない。平成22～26年度の複数年計画を単年に割り当てない。横並び説明列は原文のまま保持し、計画全体の指標・評点を転用しない。');}
  else p.warnings.push('総合戦略コメントに明示された事業別実施説明のみ収録。開始年度を評価年度とせず、累積値・施策共通KPIを当事業の年度実績に転記しない。月イチ園むすびとむらふぇすは共同記述一単位であり独立した二事業の成果ではない。');
  return [p];});
}
