import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** Explicit individual evaluation statements in the reviewed HTML sources, not link-only pages. */
export function extractReviewedHtmlSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='html')return [];
 if(input.municipalityCode==='03402'&&input.sourceId==='4af5f378885a47a121f00131'){
  const start=input.text.indexOf('5事業についての協議会の評価は以下のとおり決定した');const end=input.text.indexOf('このページは参考になりましたか？',start);
  if(start<0||end<0||!input.text.includes('令和7年11月17日'))return [];
  const section=input.text.slice(start,end);const heads=[...section.matchAll(/^(.+?)・・・(現状の規模で継続|拡大して継続|縮小して継続|終了)$/gm)];
  if(heads.length!==5)return [];
  return heads.map((h,i)=>{const raw=section.slice(h.index!,heads[i+1]?.index??section.length);const p=project(input,`name:${h[1]}`,h[1],2025,raw,start+h.index!);p.ratings.push({kind:'external',label:'行財政改革推進協議会評価',value:h[2],scale:null,evidence:evidence(input,h[0],start+h.index!)});p.warnings.push('令和7年11月17日の協議会評価5事業。対象実施年度は個別評価の段落に明示がなく未設定。直前の行革プラン全体の実績年度・数値は各事業へ割り当てない。');return p;});
 }
 if(input.municipalityCode==='21206'&&input.sourceId==='3e33436381baf4b812c295a6'){
  const lead='平成29年度事務事業にかかる内部評価（平成30年度実施）で「C評価 縮小/見直し」とされ、取り組み内容に課題や問題点のある5事業を評価';
  const start=input.text.indexOf(lead);const end=input.text.indexOf('（注意）括弧内は対象事業のうち',start);
  if(start<0||end<0)return [];const raw=input.text.slice(start,end);const rows:ProjectEvaluation[]=[];
  for(const m of raw.matchAll(/^(.+?)【([^\n]+)】$/gm)){
   const p=project(input,`name:${m[1]}`,m[1],2018,raw,start);p.department=m[2];p.evaluatedFiscalYear=2017;
   p.ratings.push({kind:'self',label:'平成30年度実施内部評価',value:'C 縮小/見直し',scale:null,evidence:evidence(input,raw,start)});
   p.warnings.push('令和元年度の再評価対象を説明する本文が、平成30年度実施・平成29年度事業のC評価5件を列挙しているため、その過去の評価だけを採用。再評価の結果や全事業の評価完了は示していない。括弧内の取組範囲を保持。');rows.push(p);
  }
  return rows.length===5?rows:[];
 }
 if(input.municipalityCode==='17204'&&input.sourceId==='deaf62946c78f0b70f2e0c40'){
  const start=input.text.indexOf('1．事業概要');const end=input.text.indexOf('\nお問い合わせ',start);
  if(start<0||end<0||!input.text.includes('令和8年度に実施した高度無線環境整備推進事業の中間評価結果'))return [];
  const raw=input.text.slice(start,end);const p=project(input,'wireless-environment','高度無線環境整備推進事業',2026,raw,start);p.evaluatedFiscalYear=2025;
  const outcome=raw.slice(raw.indexOf('3．評価'));p.outcomes=outcome;p.evidence.push(evidence(input,outcome,start+raw.indexOf('3．評価')));
  const wifi='家庭用Wi-Fiの設置数\n1,672 箇所\n（令和5年度）\n1,045箇所\n1,040箇所\n1,054箇所';
  if(raw.includes(wifi))for(const [fiscalYear,actual] of [[2023,'1,045'],[2024,'1,040'],[2025,'1,054']] as const)p.indicators.push({name:'家庭用Wi-Fiの設置数（累計）',fiscalYear,actual,target:fiscalYear===2023?'1,672':null,unit:'箇所',evidence:evidence(input,wifi)});
  p.warnings.push('評価実施は令和8年度、評価本文は令和7年度3月末累計を対象。事業開始・工事完了年度と区別。令和8年度見直し目標の再掲で実績を二重計上しない。金額は掲載なし。');return [p];
 }
 if(input.municipalityCode==='12221'&&input.sourceId==='a6ec779b2d1d72d347d1af83'){
  const start=input.text.indexOf('※「事業仕分け判定結果詳細」の事業番号2-4');const end=input.text.indexOf('\n事業仕分け判定結果一覧[',start);
  if(start<0||end<0)return [];const raw=input.text.slice(start,end);
  if(!raw.includes('訂正後 要改善 ：10 現行通り：2'))return [];
  const p=project(input,'2-4','緑地保全事業（緑化推進）',2014,raw,start);
  p.ratings.push({kind:'external',label:'市民判定人の判定内訳（訂正後）',value:'要改善：10、現行通り：2',scale:null,evidence:evidence(input,raw,start)});
  p.warnings.push('平成26年度事業仕分け判定結果の訂正記事から個別事業の訂正後投票内訳のみ抽出。対象会計年度は本文から確定できず未設定。多数決判定への変換や他の評価者との合算はしない。');return [p];
 }
 if(input.municipalityCode==='22344'&&input.sourceId==='607cb9ffeb0e7514681d82e2'){
  const raw='道路事業評価委員会を開催し、（仮称）小山スマートICアクセス道路事業の事業評価及び、社会資本総合整備計画の事後評価について、委員による審議の結果、承認されました。';
  if(!input.text.includes(raw)||!input.text.startsWith('平成30年度 事業評価'))return [];
  const p=project(input,'oyama-smart-ic-access','（仮称）小山スマートICアクセス道路事業',2018,raw);
  p.ratings.push({kind:'external',label:'道路事業評価委員会の審議結果',value:'承認',scale:null,evidence:evidence(input,raw)});
  p.warnings.push('HTMLで明記された単独道路事業の審議結果だけを抽出。併記の社会資本総合整備計画は施策群として除外。対象会計年度や費用、成果指標はリンク先にあり未確定。');return [p];
 }
 return [];
}
