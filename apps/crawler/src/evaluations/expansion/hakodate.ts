import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Acquired 2024 individual logic-model sheets, not the separate action-summary list. */
export function extractHakodate(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01202' || input.sourceId !== '87598cde9f20390b37d72f0a') return [];
  const starts = [...input.text.matchAll(/^令和６年度 \(2024年度\)事業評価調書/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i].index!;
    const raw = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const title = raw.match(/\(中事項\)\n([^\n]+) 開始年度/);
    const identifier = raw.match(/\s([1-5]-[0-9]+)\s*$/);
    const major = raw.match(/（大事項）(.+?) インプット/);
    if (!title || !identifier || !raw.includes('所管部局による今後の方針') || !raw.includes('職員の体制')) continue;
    const record = project(input, `調書${identifier[1]}`, title[1], 2024, raw, start);
    record.department = raw.match(/^主 管 (.+?) 関係部局/m)?.[1] ?? null;
    const fiscalLabel = raw.match(/令和[5５]年度決算額/);
    if (fiscalLabel) {
      record.evaluatedFiscalYear = 2023;
      const cost = raw.match(/基本目標 [^\n]*? ([0-9,]+)千円/);
      const costStart = fiscalLabel.index!;
      if (cost && cost.index! > costStart) {
        const excerpt = raw.slice(costStart, cost.index! + cost[0].length);
        record.amounts.push({ kind: 'actual', fiscalYear: 2023, amountYen: Number(cost[1].replaceAll(',', '')) * 1000,
          rawValue: cost[1], rawUnit: '千円', evidence: evidence(input, excerpt, start + costStart) });
      }
    }
    const rating = raw.match(/有効性･必要性 ([１-５]) ([^\n]+)/);
    if (rating) record.ratings.push({ kind: 'self', label: '市全体の評価：有効性・必要性', value: `${rating[1]} ${rating[2]}`,
      scale: null, evidence: evidence(input, rating[0], start + rating.index!) });
    record.warnings.push(`原典の調書識別子${identifier[1]}をprojectCodeに採用。大事項：${major?.[1] ?? '不明'}。`);
    record.warnings.push('ロジックモデルとロードマップの左右列が混在するため、成果指標・活動指標と数値の対応は推測せず個票本文証拠に保持。費用は令和5年度決算額のみ、特定財源内訳を二重計上していません。');
    result.push(record);
  }
  return result;
}
