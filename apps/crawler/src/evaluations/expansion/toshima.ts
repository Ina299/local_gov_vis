import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractToshima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13116' || input.sourceId !== 'b7b2eb8e7fc28693dae05038' || input.truncated) return [];
  const raw = input.text;
  if (!raw.startsWith('令和4年度（令和5年度実施）事務事業評価表') || !raw.includes('《上記判断を踏まえた所管課の認識・R5年度以降に向けての対応》')) return [];
  const heading = raw.match(/事業整理番号 ([\d]+) - ([\d]+)\n事務事業名 (.+?) 担当組織 ([^\n]+)/);
  if (!heading) return [];
  const p = project(input, `${heading[1]}-${heading[2]}`, heading[3], 2023, raw, 0);
  p.evaluatedFiscalYear = 2022;
  p.department = heading[4];
  p.purpose = raw.match(/（２）\n([\s\S]*?)\n（３）事業概要/)?.[1].replace(/\n(?:事業の目的・期|待する効果)(?=\n|$)/g, '').trim() ?? null;
  p.activities = raw.match(/（３）事業概要 ([\s\S]*?)\n４年度の/)?.[1].trim() ?? null;
  p.outcomes = raw.match(/①目標に対する成果状況を踏まえた課題（再掲）\n([\s\S]*?)\n②現状の実施状況/)?.[1].trim() ?? null;
  const costs = raw.match(/２．事業費の推移\n単位 ３年度 ４年度 ５年度\n金額の項目：千円 増減\n人数の項目：人 予算 決算 予算 決算 執行率 予算\n（R4決算比）\n事業費 Ａ ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) [\d.]+% ([\d,]+) -?[\d,]+/);
  if (costs) for (const [col, fiscalYear, kind] of [[1,2021,'budget'],[2,2021,'actual'],[3,2022,'budget'],[4,2022,'actual'],[5,2023,'budget']] as const) {
    p.amounts.push({kind,fiscalYear,amountYen:Number(costs[col].replaceAll(',',''))*1000,rawValue:costs[col],rawUnit:'千円',evidence:evidence(input,costs[0],costs.index)});
  }
  const outcome = raw.match(/目指す 3年度 ４年度 ５年度\n[\s\S]*?標 事業目標 ① ([^\n]+)\nの の\n(％) → ([\d.]+) ([\d.]+) ([\d.]+) [\d.]+% ([\d.]+)/);
  const activity = raw.match(/目指す ３年度 ４年度 ５年度\n活動指標[\s\S]*?\n未達成の 未達成または\n状況 達成 一部未達成の理由/);
  const add = (name:string, unit:string, values:string[], rawEvidence:string, offset:number) => {
    for (const [fiscalYear,target,actual] of [[2021,null,values[0]],[2022,values[1],values[2]],[2023,values[3],null]] as const) {
      p.indicators.push({name,fiscalYear,target,actual,unit,evidence:evidence(input,rawEvidence,offset)});
    }
  };
  if (outcome) add(`【成果指標】${outcome[1]}`,outcome[2],outcome.slice(3,7),outcome[0],outcome.index!);
  if (activity) {
    const a = activity[0].match(/① ([^\n]+) → (回) ([\d.]+) ([\d.]+) ([\d.]+) [\d.]+% ([\d.]+)/);
    const b = activity[0].match(/実施状況 ② ([^\n]+)\n→ (回) ([\d.]+) ([\d.]+) ([\d.]+) [\d.]+% ([\d.]+)/);
    for (const row of [a,b]) if (row) add(`【活動指標】${row[1]}`,row[2],row.slice(3,7),activity[0],activity.index!);
  }
  const total = raw.match(/総合評価（d＝a＋b＋c） (ランク[０-９0-9]+)/);
  if (total) p.ratings.push({kind:'self',label:'総合評価',value:total[1],scale:null,evidence:evidence(input,total[0],total.index)});
  const direction = raw.match(/今後の事業の方向性（d＋e）\n（現状の評価および施策評価を踏まえた評価） (D：終了)/);
  if (direction) p.ratings.push({kind:'self',label:'今後の事業の方向性',value:direction[1],scale:null,evidence:evidence(input,direction[0],direction.index)});
  p.warnings.push('令和4年度対象と令和5年度評価実施を区別。費用は事業費Aの明示予算・決算のみ、人件費Bと人件費込みCは重複登録せず本文保持。指標はR3実績、R4計画・実績、R5計画を分離し、達成率を実績値に転用しない。');
  return [p];
}
