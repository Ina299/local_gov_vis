import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const years = '平成30年度 令和元年度 令和2年度 令和3年度 令和4年度';
const missing = /^[－―ー-]$/;

/** R4 individual sheets: only five explicitly represented annual cells can be mapped. */
export function extractKasukabe(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11214' || input.format !== 'pdf' || !input.text.startsWith('行政評価シート\n【令和４年度実績】')) return [];
  const headers = [...input.text.matchAll(/◆行政評価シート（第２次春日部市総合振興計画事業管理シート）/g)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    if (input.truncated && i === headers.length - 1) continue;
    const start = headers[i].index!;
    const text = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    if (!/今後の[^]*方向性[^]*\n\d+\s*$/.test(text)) continue;
    const code = text.match(/実施計画№ ([\d・]+) 重点/)?.[1];
    const name = text.match(/事業名\n（補助金名）\n([^\n]+) 課名 ([^\n]+)/);
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    const record = project(input, code, name[1], null, text, start);
    record.evaluatedFiscalYear = 2022;
    record.department = name[2];
    if (code.includes('・')) record.warnings.push('同一の実施計画番号を併記した再掲個票は1事業として取り込み、重複計上しません。');
    const yearOffset = text.indexOf(years);
    const cost = text.match(/^決算額\(千円\) ([^\n]+)$/m);
    if (yearOffset >= 0 && cost && cost.index! > yearOffset) {
      const cells = cost[1].trim().split(/\s+/);
      if (cells.length === 5 && cells.every(c => /^[\d,.]+$/.test(c) || missing.test(c))) {
        const value = cells[4];
        if (/^[\d,]+(?:\.\d+)?$/.test(value)) {
          const amountYen = Number(value.replaceAll(',', '')) * 1000;
          if (Number.isSafeInteger(amountYen)) record.amounts.push({ kind: 'actual', fiscalYear: 2022, amountYen,
            rawValue: value, rawUnit: '千円', evidence: evidence(input, text.slice(yearOffset, cost.index! + cost[0].length), start + yearOffset) });
        }
      }
    }
    const indicatorName = text.match(/成果 現状値[^\n]*\n指標\n([^\n]+?) [(（]平成\d+年度[)）]/)?.[1];
    const actual = text.match(/^成果指標の実績値 ([^\n]+)$/m);
    const target = text.match(/^成果指標の目標値 ([^\n]+)$/m);
    if (yearOffset >= 0 && indicatorName && actual && actual.index! > yearOffset) {
      const actuals = actual[1].trim().split(/\s+/);
      const targets = target?.[1].trim().split(/\s+/);
      const numeric = /^([\d,]+(?:\.\d+)?)([%％人件団体機関施設園校回冊台戸日組名]*)$/;
      const value = actuals.length === 5 ? actuals[4].match(numeric) : null;
      if (value && actuals.every(c => numeric.test(c) || missing.test(c))) {
        const goal = targets?.length === 5 && targets.every(c => numeric.test(c) || missing.test(c)) ? targets[4].match(numeric) : null;
        record.indicators.push({ name: `【成果指標】${indicatorName}`, fiscalYear: 2022, actual: value[1],
          target: goal && goal[2] === value[2] ? goal[1] : null, unit: value[2] || null,
          evidence: evidence(input, text.slice(yearOffset, actual.index! + actual[0].length), start + yearOffset) });
      }
    }
    record.warnings.push('5年度分すべてのセル位置が明示された表のみ令和4年度を抽出。複数指標を上下段・括弧内に併記した表や空欄の詰まった列、グラフから数値を推測していません。');
    records.push(record);
  }
  // Distinct projects reuse four or five consecutive annual cost values. Keep their
  // identities/KPIs, but do not attribute these potentially shared costs to each project.
  const sharedCostGroups = [
    { codes: ['63', '64'], period: '平成30〜令和4年度の5年分' },
    { codes: ['68', '69', '70'], period: '令和元〜令和4年度の4年分（68・69は平成30年度も一致、70の平成30年度は異なる）' },
    { codes: ['73', '75'], period: '平成30〜令和4年度の5年分' },
  ];
  for (const group of sharedCostGroups) for (const record of records.filter(p => group.codes.includes(p.projectCode ?? ''))) {
    record.amounts = [];
    record.warnings.push(`実施計画番号${group.codes.join('・')}は異なる事業記述を持つ一方、${group.period}の決算列が同一。共通経費の再掲か個別事業費か確認できないため金額の数値化を保留。金額は個票全文の原文証拠に保持し、按分・重複加算していません。`);
  }
  return records;
}
