import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractKamisato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11385' || input.sourceId !== 'cae717f81825be62830b0bc9' || input.truncated) return [];
  const raw = input.text;
  if (!raw.startsWith('様式第１号\n事 務 事 業 評 価 表') || !raw.includes('40.評 価 理 由')) return [];
  const name = raw.match(/名 称\n([^\n]+)\n3\.主管課・係名([^\n]+)/);
  const year = raw.match(/4\.評価年度 平成(\d+)年度/);
  const code = raw.match(/事務事業整理シート番号 (\d+)/);
  if (!name || !year || !code) return [];
  const evaluatedYear = 1988 + Number(year[1]);
  const p = project(input, code[1], name[1], evaluatedYear, raw, 0);
  p.evaluatedFiscalYear = evaluatedYear;
  p.department = name[2];
  p.purpose = raw.match(/16\.事業の目的 ([\s\S]*?)\nE\.事務事業/)?.[1].trim() ?? null;
  p.activities = raw.match(/18\.事業の手段 ([\s\S]*?)\n区 分 単位/)?.[1].trim() ?? null;
  const costs = raw.match(/区 分 単位 平成２６年度決算 平成２７年度決算 構成比 ％ 平成２８年度予算\n19\.事 業 費 千円 ([\d,]+) ([\d,]+) #DIV\/0! ([\d,]+)/);
  if (costs) for (const [col, fiscalYear, kind] of [[1,2014,'actual'],[2,2015,'actual'],[3,2016,'budget']] as const) {
    p.amounts.push({kind, fiscalYear, amountYen: Number(costs[col].replaceAll(',', '')) * 1000,
      rawValue: costs[col], rawUnit: '千円', evidence: evidence(input, costs[0], costs.index)});
  }
  const rating = raw.match(/● (期待している効果や成果までは到達してない。) （評価 １０～１７点）/);
  if (rating) p.ratings.push({kind:'self', label:'第1次総合評価', value:rating[1], scale:'原文の総合評価区分（評価10～17点）', evidence:evidence(input,rating[0],rating.index)});
  const improvement = raw.match(/■ 改善（関与・手続など見直し）/);
  if (improvement) p.ratings.push({kind:'self', label:'事業の展開', value:'改善（関与・手続など見直し）', scale:null, evidence:evidence(input,improvement[0],improvement.index)});
  p.warnings.push('原文の評価年度平成27年度と作成日平成28年8月24日を区別。平成27年度事業費の明示0は保持する一方、人件費空欄や#DIV/0!は0として補完しない。活動・成果指標名と実績欄は空欄のため未登録。第2次評価は未記入。');
  return [p];
}
