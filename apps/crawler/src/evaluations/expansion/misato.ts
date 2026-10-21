import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Only the complete, individually titled Misato FY2015 evaluation-sheet format. */
export function extractMisato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05434' || input.truncated) return [];
  const headers = [...input.text.matchAll(/^平成２７年度\n事業評価シート\n/gm)];
  const result: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const block = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const titleArea = block.slice(headers[i][0].length, block.indexOf('総合計画の'));
    const normal = /^事務事業名 (.+?) 担当課名 (.+)\n$/.exec(titleArea);
    const wrapped = /^([^\n]+)\n事務事業名 担当課名 ([^\n]+)\n(\([^\n]+\))\n$/.exec(titleArea);
    const name = normal?.[1] ?? (wrapped ? `${wrapped[1]}${wrapped[3]}` : null);
    const department = normal?.[2] ?? wrapped?.[2];
    // Footer is required: partial last sheets and overview rows do not become records.
    if (!name || !department || !/美郷町教育委員会\n\d+\s*$/.test(block)) continue;
    const costs = /年度・区分 平成26年度決算 平成27年度決算 平成28年度予算\n事 業 費\n金 額 ([\d,]+|[-－]) 千円 ([\d,]+|[-－]) 千円 ([\d,]+|[-－]) 千円/.exec(block);
    if (!costs) continue;
    const code = `name:${name}`;
    if (seen.has(code)) continue;
    seen.add(code);
    const record = project(input, code, name, 2015, block, start);
    record.department = department;
    record.evaluatedFiscalYear = 2015;
    record.warnings.push('事業コードは原典にないため名称から識別キーを生成。効果・実績欄は活動実績と効果の記述を含む原文であり、成果指標に一律換算していません。');
    record.amounts = [2014, 2015, 2016].map((year, column) => ({
      kind: column === 2 ? 'budget' : 'actual', fiscalYear: year,
      amountYen: /^\d/.test(costs[column + 1]) ? Number(costs[column + 1].replaceAll(',', '')) * 1000 : null,
      rawValue: costs[column + 1], rawUnit: '千円', evidence: evidence(input, costs[0], start + costs.index),
    }));
    const outcomeStart = costs.index + costs[0].length;
    const outcomeEnd = block.indexOf('必要性（', outcomeStart);
    if (outcomeEnd >= 0) {
      const raw = block.slice(outcomeStart, outcomeEnd).trim();
      record.outcomes = raw;
      record.evidence.push(evidence(input, raw, start + block.indexOf(raw, outcomeStart)));
      // Explicitly dated counts; retain the source's broad label instead of asserting outcome semantics.
      for (const match of raw.matchAll(/平成([０-９\d]{2})年度\s*(手当した園児数|延べ利用者数|登録数|総参加乳幼児数)\s*([\d,，]+)(人)/g)) {
        record.indicators.push({ name: `実績・成果等／${match[2]}`, fiscalYear: 1988 + Number(match[1].normalize('NFKC')),
          target: null, actual: match[3], unit: match[4], evidence: evidence(input, match[0], start + block.indexOf(raw, outcomeStart) + match.index!) });
      }
    }
    for (const [label, kind] of [['内部評価', 'self'], ['外部評価', 'external']] as const) {
      const rating = new RegExp(`${label} ([Ａ-ＤA-D])([^\\n]*)`).exec(block);
      if (rating) record.ratings.push({ kind, label, value: rating[1],
        scale: kind === 'self' ? rating[2].trim() || null : null,
        evidence: evidence(input, rating[0], start + rating.index) });
    }
    result.push(record);
  }
  return result;
}
