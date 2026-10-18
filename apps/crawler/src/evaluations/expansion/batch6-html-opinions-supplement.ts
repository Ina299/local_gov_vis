import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Complete HTML result rows. Linked PDFs and aggregate counts are not records. */
export function extractBatch6HtmlOpinionsSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.format !== 'html' || input.truncated) return [];
  const out: ProjectEvaluation[] = [];
  if (input.municipalityCode === '01429' && input.sourceId === '426199d17e7bc887d1cd4bf0') {
    const start = input.text.indexOf('政策分野\n評価事業\n外部評価結果\n');
    const end = input.text.indexOf('（2）\n栗山町政策評価委員', start);
    if (start < 0 || end < 0 || !input.text.includes('令和5年度政策評価結果')) return [];
    const table = input.text.slice(start, end);
    for (const m of table.matchAll(/^([^\n]+)\n(計画通りに進める)\n/gm)) {
      if (!m[1].endsWith('ます。')) continue;
      const p = project(input, `external-2023-${out.length + 1}`, m[1], 2023, m[0], start + m.index!);
      p.evaluatedFiscalYear = 2023;
      p.ratings.push({ kind: 'external', label: '政策評価委員会 外部評価結果', value: m[2], scale: null, evidence: evidence(input, m[0], start + m.index!) });
      p.evidence.push(evidence(input, '事中評価における政策評価委員会（外部評価）の取り組み'));
      p.warnings.push('HTMLの計画事業別外部評価結果行。令和5年度の事中評価であり年度終了後の実績評価ではない。金額・指標・所管課は本文行にないため補完しない。');
      out.push(p);
    }
  }
  if (input.municipalityCode === '15205' && input.sourceId === 'b49d4c30011f34e096c030fc') {
    for (const year of [2017, 2016]) {
      const start = input.text.indexOf(`${year}年度外部評価結果 (PDF`);
      const end = year === 2017 ? input.text.indexOf('2016年度の外部評価結果', start) : input.text.indexOf('この記事に関するお問い合わせ先', start);
      if (start < 0 || end < 0) continue;
      const table = input.text.slice(start, end);
      for (const m of table.matchAll(/^([^\n]+)（([^\n]+)）\n(現状維持\d+人、[^\n]+)\n/gm)) {
        const p = project(input, `external-${year}-${out.length + 1}`, m[1], year, m[0], start + m.index!);
        p.department = m[2]; p.evaluatedFiscalYear = year - 1;
        p.ratings.push({ kind: 'external', label: '外部評価 委員別判定人数', value: m[3], scale: null, evidence: evidence(input, m[0], start + m.index!) });
        const annualLabel = year === 2017 ? '内部評価シート（平成28年度執行事業）' : '2016年度事務事業評価表（平成27年度実績評価）';
        p.evidence.push(evidence(input, annualLabel));
        p.warnings.push('HTMLの事業別外部評価投票内訳を原文で保持。最多票を市の最終評価へ変換しない。リンク先個票の費用や指標は本文にないため補完しない。');
        out.push(p);
      }
    }
  }
  return out;
}
