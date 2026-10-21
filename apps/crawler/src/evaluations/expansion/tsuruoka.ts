import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project} from './shared';
const names=new Set(['診療材料等の共同購入の推進','水道事業包括委託の拡大','下水道PRと併せた新たな自主財源確保策','焼却施設の自家消費・売電推進','電力契約の見直し','e-でわネットの民間移行','ふるさと納税の推進','庁舎ＬＥＤ照明リース事業','朝日庁舎の再整備','RPA・AI-OCRの導入','藤島エコ有機センターの経営健全化','スキー場の経営健全化']);
export function extractTsuruoka(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='06203'||input.sourceId!=='f9b14d4bb85471ad63bb1914')return [];
 const hs=[...input.text.matchAll(/^取組名 (\S+) (.+?) [■☑□]継続 主管課([^\n]*)$/gm)],rows:ProjectEvaluation[]=[];
 for(const h of hs){if(!names.has(h[2]))continue;
  const begin=input.text.lastIndexOf('行 政 評 価 調 書',h.index!),end=input.text.indexOf('行 政 評 価 調 書',h.index!+h[0].length);
  if(begin<0||(end<0&&input.truncated))continue;
  const raw=input.text.slice(begin,end<0?input.text.length:end),target=raw.match(/評価対象年度 R([45])/);
  if(!target||!raw.includes('５．自己評価・内部評価・外部評価を踏まえた取組の方向性'))continue;
  const r=project(input,h[1],h[2],2023,raw,begin);r.projectCode=null;r.evaluatedFiscalYear=2018+Number(target[1]);r.department=h[3].trim()||null;
  r.purpose=raw.match(/取組概要 ([\s\S]+?)\n(?:取組成果|年度 )/)?.[1].trim()??null;
  const ev=raw.indexOf('２．自己評価'),stop=raw.indexOf('３．内部評価',ev);r.outcomes=ev>=0&&stop>ev?raw.slice(ev,stop).trim():null;
  r.warnings.push('行政改革調書のうち具体的な購入・契約・施設整備・サービス事業の独立票を部分構造化。改革計画全体の単位とは区別。自己評価原文を保持し、交錯する評点・予算要求/見込額は構造化しない。記号付き取組番号は予算事業コードではない。');rows.push(r);
 }
 return rows;
}
