import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const sources=new Set(['e0461352d7085dece6c1957a','ca956ab17fc885531ffc3352','1a408a4f852bd2ca5bb5e179','02a67525a1e3497669a0ddde','83ea44c58916bffdd5b36594']);
/** Management-policy Roman numerals; template and example sheets excluded. */
export function extractIkomaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='29209'||input.format!=='pdf'||!sources.has(input.sourceId))return [];
 const heads=[...input.text.matchAll(/^令和([６７])年度アクションプラン 事業評価シート[^\n]*\n/gm)];
 const rows:ProjectEvaluation[]=[];const seen=new Set<string>();
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const h=heads[i];const start=h.index!;const raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
  const identity=raw.match(/^事 業 名 No\. (\d+(?:-\d+)?) ([^\n]+)\n事 業 区 分/m);
  const policy=raw.match(/^施 策 体 系 ([ⅠⅡⅢⅣ]|8) [^\n]+? 戦 略 的 施 策/m);
  if(!identity||!policy||(policy[1]==='8'&&!['5-1','5-2'].includes(identity[1]))||!raw.includes('４ 事業の成果・評価')||!raw.includes('今後の取組方針'))continue;
  const year=2018+Number(h[1].normalize('NFKC'));const code=policy[1]==='8'?`8-${identity[1]}`:`management:${policy[1]}-${identity[1]}`;
  if(seen.has(code))throw new Error(`Duplicate Ikoma supplement ${code}`);seen.add(code);
  const p=project(input,code,identity[2],null,raw,start);p.evaluatedFiscalYear=year;
  p.department=raw.match(/担 当 課 (.+?) 関 係 課/)?.[1]??null;
  const outcome=raw.match(/^「めざす状態」実現に[\s\S]*?(?=\nKPI 指標１ 指標２)/m);
  if(outcome){p.outcomes=outcome[0];p.evidence.push(evidence(input,outcome[0],start+outcome.index!));}
  const kpi=raw.match(/^指標名（単位） ([^\s]+)\n目標値 ([^\s]+)\n実績値 ([^\s]+)\n/m);
  if(kpi)p.indicators.push({name:`【KPI・活動成果区分未確認】${kpi[1]}`,fiscalYear:year,target:kpi[2],actual:kpi[3],unit:null,evidence:evidence(input,kpi[0],start+kpi.index!)});
  const dir=raw.match(/^今後の取組方針 (現状維持|拡大|縮小|改善|廃止|終了|見直し|統合)(?= |\n)/m);
  if(dir)p.ratings.push({kind:'self',label:'今後の取組方針',value:dir[1],scale:null,evidence:evidence(input,dir[0],start+dir.index!)});
  p.warnings.push('経営的施策の個別アクションプラン事業を追加抽出。施策番号はローマ数字で基本的施策の算用数字と区別。対象年度はシート表題と当該年度決算欄に従う。評価実施年度は未確定。実績・成果は当該シート原文に従う。決算（見込）と確定決算を混同せず費用は数値化しない。複数列KPIや空欄位置は推測しない。');
  if(policy[1]==='8')p.warnings.push('事業番号5-1/5-2は別票として保存。5-2は未完了のため評価を行わないとの原文を保持し、今後の方針を評価済み総合判定と混同しない。');
  rows.push(p);
 }
 return rows;
}
