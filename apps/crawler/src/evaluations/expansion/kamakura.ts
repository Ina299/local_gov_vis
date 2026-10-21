import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** One full administrative business per sheet; component rows are not extra projects. */
export function extractKamakura(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='14204'||input.format!=='pdf'||input.truncated)return [];
  const raw=input.text;
  const explicitCycle=raw.startsWith('令和６年（2024年）度行政評価シート【個表】');
  const missingHeading=input.sourceId==='c81db291b3d6da4d39dd92ca'&&raw.startsWith('令和 6 年 6 月 21 日');
  if((!explicitCycle&&!missingHeading)||!raw.includes('◎他市比較・ベンチマーク'))return [];
  const h=raw.match(/^([^\s]+) [■□] 自治事務 主管課 ([^\n]+)\n([^\n]+)\n/m);
  const year=raw.match(/2 令和５年（2023年）度に実施した事業の概要/);
  const cost=raw.match(/事業費の合計 （千円） ([\d,]+) \/ ([\d,]+) ([\d,]+)/);
  const direction=raw.match(/【今後の方針】([^\n]+)/);
  if(!h||!year||!cost||!direction||!raw.includes('事業費（決算／当初）（千円） 予算額（千円）'))return [];
  const p=project(input,h[1].normalize('NFKC').replace(/[ｰー－]/g,'-'),h[3],explicitCycle?2024:null,raw,0);
  p.evaluatedFiscalYear=2023;p.department=h[2];
  const purpose=raw.match(/\n意[ \n]([\s\S]*?)\n効[ \n]/);
  if(purpose)p.purpose=purpose[1].replace(/\n図[ \n]/g,'\n').replace(/\n図$/,'').trim();
  p.activities=raw.match(/2 令和５年（2023年）度に実施した事業の概要\n([\s\S]*?)\n3 事業を構成する/)?.[1].trim()??null;
  const analysis=raw.match(/\(１\) 最小事業評価\n([\s\S]*?)\n\(２\) 視点別評価/);
  if(analysis)p.outcomes=analysis[1].trim();
  const costHeader=raw.indexOf('3 事業を構成する');
  const costEnd=cost.index!+cost[0].length;
  for(const[col,fiscalYear,kind]of[[1,2023,'actual'],[2,2023,'budget'],[3,2024,'budget']]as const)p.amounts.push({kind,fiscalYear,amountYen:Number(cost[col].replaceAll(',',''))*1000,rawValue:cost[col],rawUnit:'千円',evidence:evidence(input,raw.slice(costHeader,costEnd),costHeader)});
  for(const choice of direction[1].matchAll(/■ ([^□■]+?)(?= [□■]|$)/g))p.ratings.push({kind:'self',label:'今後の方針',value:choice[1].trim(),scale:null,evidence:evidence(input,direction[0],direction.index)});
  p.warnings.push('評価対象事業単位で収録。構成する最小事業を別事業として重複計上せず、当年度の事業費合計と当初予算・翌年度予算を分離。最小事業評価の横並び本文は列別に推定分割せず保持。参考指標は空欄・折返し・県内統計等の対象範囲が混在するため本文に保持。人件費を事業費へ加算していません。');
  if(missingHeading)p.warnings.push('評価シート表題が保存本文から欠落し作成日のみ確認できるため、評価実施年度は未設定。対象実績年度は本文の令和5年度。');
  if(p.projectCode==='教育-03'||p.projectCode==='教育-31')p.warnings.push('同年度同主管課に同名の教育支援事業が2票存在する。原文コード教育-03はスクールコラボファンド等、教育-31は外国語指導助手・学校図書館専門員等で、実施概要・評価者・費用の異なる独立評価票として保持。');
  return[p];
}
