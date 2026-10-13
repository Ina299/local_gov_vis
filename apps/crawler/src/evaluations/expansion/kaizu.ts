import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const DOCUMENTS = new Set(['10e31a9d485160629a1bc333', 'ed3196ee87afabaca9ffb2c8']);
const COVER = '982b3dbd86b80c24870b5012';

/** Only the two acquired project-sheet sections; the cover contains an annotated example. */
export function extractKaizu(input: CachedInput, reportCover?: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '21221' || !DOCUMENTS.has(input.sourceId)) return [];
  const yearLabel = reportCover?.municipalityCode === '21221' && reportCover.sourceId === COVER
    ? reportCover.text.match(/^令和７年度 海津市行政評価報告書\n（令和６年度実施分）/) : null;
  const year = yearLabel ? 2025 : null;
  const assessedYear = yearLabel ? 2024 : null;
  const starts = [...input.text.matchAll(/^.*単位：千円 ([^\n]+)\n会計名 一般会計 事業名 (\d+) ([^\n]+?) 活 ([^\n]+)\n/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    const match = starts[i];
    if (input.truncated && i === starts.length - 1) continue;
    const start = match.index!;
    const raw = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const account = ['款', '項', '目'].map(label => raw.match(new RegExp(`^${label} (\\d+) `, 'm'))?.[1]);
    if (account.some(x => !x) || !raw.includes('事業成果') || !raw.includes('取組方針')) continue;
    const code = `一般会計-${account.join('-')}-${match[2]}`;
    const record = project(input, code, match[3].trim(), year, raw, start);
    record.evaluatedFiscalYear = assessedYear;
    record.department = match[1].trim();
    if (yearLabel && reportCover) record.evidence.push(evidence(reportCover, yearLabel[0], yearLabel.index));
    else record.warnings.push('評価年度・対象年度は表紙未照合のため不明。');
    record.warnings.push('事業全体の予算・決算総額（人件費を含む場合あり）。細事業別の費用には分配していません。');
    for (const [label, kind, fiscalYear] of [
      ['前年度決算額', 'actual', assessedYear === null ? null : assessedYear - 1],
      ['予算額', 'budget', assessedYear], ['決算額', 'actual', assessedYear],
    ] as const) {
      const row = raw.match(new RegExp(`^${label} ([0-9][0-9,]*)(?= |$)[^\\n]*`, 'm'));
      if (!row) continue;
      record.amounts.push({ kind, fiscalYear, amountYen: Number(row[1].replaceAll(',', '')) * 1000,
        rawValue: row[1], rawUnit: '千円', evidence: evidence(input, row[0], start + row.index!) });
    }
    const outcome = raw.match(/ 成 ([^\n]+)\n果(?:\n|$)/);
    const indicatorRows = [...raw.matchAll(/(?:^| )標 ([0-9][0-9,.]*) ([0-9][0-9,.]*) ([0-9.]+%) [ABC](?=\n|$)/g)];
    const descriptors = [{ label: '活動指標', text: match[4] }, { label: '成果指標', text: outcome?.[1] }];
    for (let j = 0; j < descriptors.length; j++) {
      const descriptor = descriptors[j];
      if (!descriptor.text || descriptor.text.includes('指標設定しない')) continue;
      const named = descriptor.text.match(/^(.+) ([^ ]+)$/);
      if (!named) continue;
      // Values are safe only when both explicitly named indicators have exactly two numeric rows.
      const row = descriptors.every(d => d.text && !d.text.includes('指標設定しない')) && indicatorRows.length === 2
        ? indicatorRows[j] : null;
      record.indicators.push({ name: `【${descriptor.label}】${named[1]}`, fiscalYear: assessedYear,
        unit: named[2], target: row?.[1] ?? null, actual: row?.[2] ?? null,
        evidence: evidence(input, raw, start) });
    }
    const direction = raw.match(/^区分 (現状維持|拡充|縮小|統合|廃止・終了)/m);
    if (direction) record.ratings.push({ kind: 'self', label: '来年度（R8）の方向性', value: direction[1],
      scale: null, evidence: evidence(input, direction[0], start + direction.index!) });
    // Two-column narrative order is not recoverable from this text; retain it in exact evidence.
    record.warnings.push('事業成果・目的等の文章は左右列が混在するため本文証拠に保持し、独立した文章項目へ再構成していません。');
    result.push(record);
  }
  return result;
}
