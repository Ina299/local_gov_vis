import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractHokkaidoSingleSupplement(input: CachedInput, inputs: CachedInput[] = []): ProjectEvaluation[] {
 if(input.truncated)return [];
 if(input.municipalityCode==='01462'&&input.sourceId==='accc2aff4237f776199dd7ad'&&input.text.includes('Ⅱ．事業評価個表（平成30年度）')){
  const p=project(input,'1','南富良野町立保育所運営事業',2018,input.text);
  p.evaluatedFiscalYear=2018;p.department='企画課';
  const a='南富良野町内保育所の保育所職員人件費（保育所長1名、保育士3名）5ケ月分';if(input.text.includes(a))p.activities=a;
  const start=input.text.indexOf('本交付金を活用して');const end=input.text.indexOf('評価に係る第三者機関等の活用の有無',start);
  if(start<0||end<0)return [];p.outcomes=input.text.slice(start,end).trim();
  const outcome=input.text.match(/成果目標 成果指標 単位 評価年度 平成３０年度[\s\S]*?評価年度の設定理由/);
  if(outcome&&outcome[0].includes('成果実績 ％ 100')&&outcome[0].includes('目標値 ％ 100'))p.indicators.push({name:'【成果指標】入所率',fiscalYear:2018,target:'100',actual:'100',unit:'％',evidence:evidence(input,outcome[0],outcome.index)});
  const activity=input.text.match(/活動指標 単位 平成28年度 平成29年度 平成30年度[\s\S]*?交付金事業の総事業/);
  if(activity&&activity[0].includes('保育所長・保育士の雇用量 活動実績 人月 20 20 20')&&activity[0].includes('活動見込 人月 20 20 20'))for(const y of[2016,2017,2018])p.indicators.push({name:'【活動指標】保育所長・保育士の雇用量',fiscalYear:y,target:'20',actual:'20',unit:'人月',evidence:evidence(input,activity[0],activity.index)});
  p.warnings.push('総事業費・契約金額の数字はあるが保存本文に通貨単位の明示がないためamounts未変換。成果欄は次年度改善方針も含む原文。');return[p];
 }
 if(input.municipalityCode==='01462'&&input.sourceId==='5958fa7502da9939b44a1f0b'){
  const raw='なお、令和元年度は、次の事業に交付金が使われました。\n【交付金総額 5,861,000円】 ○保育所運営事業（保育士人件費）';if(!input.text.includes(raw))return[];
  const p=project(input,'grant-use-2019','保育所運営事業',null,raw);p.evaluatedFiscalYear=2019;p.activities=raw;
  p.warnings.push('令和元年度の交付金活用実績の案内のみ。評価実施年度と成果指標は未掲載。交付金総額は事業の決算総額や人件費総額と同一とは限らないためamountsへ転記しない。平成27～30年度のリンク行は別レコード化しない。');return[p];
 }
 if(input.municipalityCode==='01425'&&input.sourceId==='adff51fe8a81fcad9780cd6b'){
  const cover=inputs.find(x=>x.sourceId==='b7af570f841beb85dc24b49b'&&x.text.includes('令和7年度（令和6年10月～令和7年9月）'));
  const p=project(input,'feeder','地域内フィーダー系統確保維持費国庫補助金',cover?2025:null,input.text);
  if(cover){p.evaluatedFiscalYear=2025;p.evidence.push(evidence(cover,'令和7年度（令和6年10月～令和7年9月）'));}
  const starts=[...input.text.matchAll(/・運行系統名\n上砂川町乗り合いタクシー\n/g)];
  if(starts.length!==2)return[];
  for(let i=0;i<2;i++){
   const raw=input.text.slice(starts[i].index!,starts[i+1]?.index??input.text.length);const route=raw.match(/【([^】]+)】/);const users=raw.match(/目標数 ([\d,]+)人[\s\S]*?実 績 ([\d,]+)人/);const ratio=raw.match(/目標値 ([\d.]+)％[\s\S]*?実 績 ([\d.]+)％/);
   if(!route||!users||!ratio)return[];
   for(const[name,m,unit]of[['年間延べ利用者数',users,'人'],['平均収支率',ratio,'％']]as const)p.indicators.push({name:`【指標】${route[1]}／${name}`,fiscalYear:cover?2025:null,target:m[1],actual:m[2],unit,evidence:evidence(input,raw,starts[i].index)});
  }
  p.warnings.push('2運行系統は同一補助事業の系統別指標として保持。A評点・概要・改善点は横長表の列間混線があるため構造化せず原文証拠で保持。評価対象期間は令和6年10月～令和7年9月で通常の会計年度とは異なる。運賃は事業費ではない。');return[p];
 }
 return[];
}
