import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** The third money column is the assessed subproject, not the repeated parent budget. */
export function extractTomisato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12233' || input.sourceId !== 'f920e1aba63bb7dcfa34ed77') return [];
  const year = input.text.match(/^第 1 次政策実行計画事業\n（ 令和６年度）/);
  if (!year) return [];
  const starts = [...input.text.matchAll(/^事業概要及び自己評価シート 部等名 課等名 班等名/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i].index!;
    const raw = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const heading = raw.match(/政策実行計画事業 ([\d-]+)\.(.+)\n事業（予算）名 ([^\n]+)/);
    const rating = raw.match(/^事業効果 ([A-Z][:：][^\n]+)/m);
    if (!heading || !rating || !/\n\d+\s*$/.test(raw)) continue;
    const p = project(input, heading[1], `${heading[2]}（${heading[3]}）`, null, raw, start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, year[0], year.index));
    p.department = raw.split('\n')[1];
    p.activities = raw.match(/【事業概要】\n([\s\S]*?)\n【事業規模】/)?.[1].trim() ?? null;
    p.outcomes = raw.match(/【事業効果】\n([\s\S]*?)\n令和４年度 令和５年度 令和６年度/)?.[1].trim() ?? null;
    const cost = raw.match(/予算現額 決算額（本年度）①[\s\S]*?\n([\d,]+)円 ([\d,]+)円 ([\d,]+)円 ([\d,]+)円 [△\d,]+円/);
    if (cost && cost[0].includes('政策実行計画事業額')) p.amounts.push({ kind: 'actual', fiscalYear: 2024,
      amountYen: Number(cost[3].replaceAll(',', '')), rawValue: cost[3], rawUnit: '円',
      evidence: evidence(input, cost[0], start + cost.index!),
    });
    const table = raw.match(/令和４年度 令和５年度 令和６年度\n指標とする対象項目 単位\n指標 実績値 指標 実績値 指標 実績値\n([\s\S]*?)ＰＤＣＡ/);
    if (table) {
      // Only six explicit cells: shorter rows have lost the empty-year columns.
      const lines = table[1].split('\n');
      for (let n = 0; n < lines.length; n++) {
        const row = lines[n].match(/^(?:[第１次政策実行計画] )?(.+?) ([^ ]+) ((?:[\d,.]+|―)(?: (?:[\d,.]+|―)){5})$/);
        let previous = n - 1;
        while (previous >= 0 && /^[第１次政策実行計画]?$/.test(lines[previous])) previous--;
        if (!row || (previous >= 0 && !/ [\d,.―]+(?: [\d,.―]+){5}$/.test(lines[previous])) || /^R[0-9]/.test(lines[n + 1]?.replace(/^[第１次政策実行計画] /, '') ?? '')) continue;
        const cells = row[3].split(' ');
        for (let y = 0; y < 3; y++) p.indicators.push({ name: `【指標】${row[1]}`, fiscalYear: 2022 + y,
          target: cells[y * 2] === '―' ? null : cells[y * 2], actual: cells[y * 2 + 1] === '―' ? null : cells[y * 2 + 1], unit: row[2],
          evidence: evidence(input, table[0], start + table.index!),
        });
      }
    }
    p.ratings.push({ kind: 'self', label: '事業効果', value: rating[1], scale: null, evidence: evidence(input, rating[0], start + rating.index!) });
    p.warnings.push('令和6年度は対象事業年度であり評価実施年度は未確定。費用は本年度決算の内数「政策実行計画事業額」のみ。上位予算事業の予算現額・決算額・前年度額は対象範囲が異なるため未登録。指標の活動・成果区分は原文に明示なし。空欄で列数が不足する指標、折返し名、別日付注記の行は数値化せず原文に保持。');
    if (heading[1] === '40') p.warnings.push('原文の政策実行計画事業額4,987,200円と掲載内訳合計4,897,200円に90,000円の差があります。列値を原文どおり保持し、差額の理由は未確認。');
    result.push(p);
  }
  return result;
}
