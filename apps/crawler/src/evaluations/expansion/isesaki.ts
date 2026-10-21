import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '10204' || input.format !== 'pdf' || input.truncated) return [];
  const full = input.text.includes('令和 元 年度 事務事業《事後》評価 評価シート');
  const year = input.text.startsWith('令和２年度 伊勢崎市事務事業《事後》評価') ? 2020
    : input.text.startsWith('令和元年度') ? 2019 : null;
  if (!year) return [];
  const headers = [...input.text.matchAll(full
    ? /^令和 元 年度 事務事業《事後》評価 評価シート[^\n]*/gm
    : /^No\.[０-９\d]+\n/gm)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const code = raw.match(/^評価番号 ([０-９\d]+)/m)?.[1].normalize('NFKC');
    const title = raw.match(/^事務事業名 ([^\n]+)/m)?.[1];
    const name = title?.split(' 部課名 ')[0];
    if (!code || !name || seen.has(code)) continue;
    if (full ? !raw.includes('コストの内訳 単位 H26 決算') : !/\d+ \/ \d+ ページ\s*$/.test(raw)) continue;
    seen.add(code);
    const record = project(input, code, name, year, raw, start);
    record.department = full ? title?.split(' 部課名 ')[1] ?? null : raw.match(/^担当課（主管課）名 (.+)$/m)?.[1] ?? null;
    if (full) {
      if (/評価対象年度 平成 30 年度/.test(raw)) record.evaluatedFiscalYear = 2018;
      const cost = raw.match(/コストの内訳 単位 H26 決算 H27 決算 H28 決算 H29 決算 H30 決算 R1 予算\n事 業 費 千円 ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)(?= |\n)/);
      if (cost) for (const [column, kind, fiscalYear] of [[5, 'actual', 2018], [6, 'budget', 2019]] as const) {
        const amountYen = Number(cost[column].replaceAll(',', '')) * 1000;
        if (Number.isSafeInteger(amountYen)) record.amounts.push({ kind, fiscalYear, amountYen, rawValue: cost[column], rawUnit: '千円', evidence: evidence(input, cost[0], start + cost.index!) });
      }
      record.warnings.push('詳細評価票の6年度費用列が明示された場合のみH30決算とR1予算を構造化。人件費・合計・財源内訳は事業費に加算していません。左右の評価理由と指標が混在した数値は推測していません。');
    } else {
      const direction = raw.match(/最終評価 事業の方向性 ([^\n]+)/);
      if (direction) record.ratings.push({ kind: 'self', label: '最終評価・事業の方向性', value: direction[1], scale: null, evidence: evidence(input, direction[0], start + direction.index!) });
      const analysis = raw.search(/(?:１次評価|1次評価)/);
      if (analysis >= 0) record.outcomes = '評価・改善意見（原文）\n' + raw.slice(analysis).replace(/\n\d+ \/ \d+ ページ\s*$/, '').trim();
      record.warnings.push('改善事業の事業別評価意見票から部分構造化。先頭一覧の行は取り込まず、対象年度・金額はこの票から推測していません。改善予定は実現済み成果と扱いません。');
    }
    records.push(record);
  }
  return records;
}

/** Improvement opinions and detailed cost sheets for the same evaluation are one record. */
export function extractIsesaki(input: CachedInput, inputs?: CachedInput[]): ProjectEvaluation[] {
  if (!inputs) return extractOne(input);
  const groups = new Map<string, { owner: string; record: ProjectEvaluation; conflicts: Set<string> }>();
  for (const source of [...inputs].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    for (const record of extractOne(source)) {
      const key = JSON.stringify([record.evaluationYear, record.projectCode, record.projectName.normalize('NFKC')]);
      const previous = groups.get(key);
      if (!previous) { groups.set(key, { owner: source.sourceId, record, conflicts: new Set() }); continue; }
      const retained = previous.record;
      retained.evidence.push(...record.evidence);
      if (record.evaluatedFiscalYear !== null) retained.evaluatedFiscalYear = record.evaluatedFiscalYear;
      for (const amount of record.amounts) {
        const slot = `${amount.kind}:${amount.fiscalYear}`;
        if (previous.conflicts.has(slot)) continue;
        const same = retained.amounts.find(a => a.kind === amount.kind && a.fiscalYear === amount.fiscalYear);
        if (same && same.amountYen !== amount.amountYen) {
          previous.conflicts.add(slot);
          retained.amounts = retained.amounts.filter(a => `${a.kind}:${a.fiscalYear}` !== slot);
          retained.warnings.push(`再掲資料の金額競合により保留: ${slot}`);
        } else if (!same) retained.amounts.push(amount);
      }
      for (const rating of record.ratings) if (!retained.ratings.some(r => r.label === rating.label && r.value === rating.value)) retained.ratings.push(rating);
      if (!retained.outcomes && record.outcomes) retained.outcomes = record.outcomes;
      retained.warnings = [...new Set([...retained.warnings, ...record.warnings, '同一評価年度・評価番号・事業名の改善意見票と詳細評価票を統合し、事業数を重複計上していません。'])];
    }
  }
  return [...groups.values()].filter(g => g.owner === input.sourceId).map(g => g.record);
}
