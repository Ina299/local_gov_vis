import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 狭山市 令和元年度 事務事業評価表（r2_gyoseihyoka.files/r2-*.pdf、1票1事業）。 */
const HEAD = /事務事業評価表\n\n令和元年度\n(\d{6})\n\n事務\n事業\n区分\n\n所属 (\S+) (\S+)\n\n([^\n]+)\n\n事業区分\n/g;
const FORM = /^(直営|一部委託|全部委託|委託|補助|指定管理|負担|その他)/;
const yen = (s: string) => Number(s.replaceAll(',', ''));

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11215' || input.format !== 'pdf' || input.truncated
    || !/\/r2_gyoseihyoka\.files\/r2-\d+\.pdf$/.test(input.sourceUrl)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)];
  // Sheets whose header block is reordered by pdftotext are not matched; skip the whole document rather than mis-split it.
  if (!heads.length || heads.length !== text.split('事務事業評価表').length - 1) return [];
  // Projects already structured from the r2hyoka.pdf summary list are left to that record (same cycle, unknown-period identity).
  const summary = inputs.find(i => i.sourceUrl.endsWith('/r2_gyoseihyoka.files/r2hyoka.pdf'))?.text;
  if (!summary) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, end = k + 1 < heads.length ? heads[k + 1].index! : text.length, block = text.slice(start, end);
    const at = (raw: string, from = 0) => { const i = block.indexOf(raw, from); return evidence(input, raw, start + i); };
    const name = h[4].trim();
    if (summary.includes(name)) return;
    const p = project(input, h[1], name, null, block.trimEnd(), start);
    p.department = `${h[2]} ${h[3]}`; p.evaluatedFiscalYear = 2019;

    // 方向性（第一次）: either directly after its label, or on the "改善、効率化の内容" line when it is 改善・効率化.
    const dirs = [...block.matchAll(/方向性（第一次）\n\n(現行どおり|完了)\n|(?:^|\n|方向性（第一次） )(改善・効率化) 改善、効率化の内容\n/g)];
    if (dirs.length === 1) {
      const d = dirs[0], raw = d[0].replace(/^\n/, '').replace(/\n$/, '');
      p.ratings.push({ kind: 'self', label: '方向性（第一次）', value: d[1] ?? d[2], scale: null, evidence: at(raw) });
    }

    // Costs: 予算額/決算額 and the 予定値/確定値 pairs, kept only when the pairs reconcile.
    const budget = block.match(/事務事業費予算額\n\n([\d,]+) 円\n/), actual = block.match(/事務事業費決算額\n\n([\d,]+) 円\n/);
    const cost = block.match(/予定値\n\n確定値\n\n直接事業費\n\n([\d,]*) ?円\n\n直接事業費\n\n([\d,]*) ?円\n\n人件費\n\n([\d,]+) 円\n\n人件費\n\n([\d,]+) 円\n\n総額\n\n([\d,]+) 円\n\n総額\n\n([\d,]+) 円/);
    if (budget) p.amounts.push({ kind: 'budget', fiscalYear: 2019, amountYen: yen(budget[1]), rawValue: budget[1], rawUnit: '円', evidence: at(budget[0].trimEnd()) });
    if (actual) p.amounts.push({ kind: 'actual', fiscalYear: 2019, amountYen: yen(actual[1]), rawValue: actual[1], rawUnit: '円', evidence: at(actual[0].trimEnd()) });
    if (cost) {
      const [, dPlan, dFix, pPlan, pFix, tPlan, tFix] = cost;
      const okPlan = (dPlan ? yen(dPlan) : 0) + yen(pPlan) === yen(tPlan) && (dPlan ? dPlan === budget?.[1] : !budget);
      const okFix = (dFix ? yen(dFix) : 0) + yen(pFix) === yen(tFix) && (dFix ? dFix === actual?.[1] : !actual);
      if (okPlan && okFix) {
        const ev = at(cost[0]);
        p.amounts.push({ kind: 'personnel', fiscalYear: 2019, amountYen: yen(pFix), rawValue: pFix, rawUnit: '円', evidence: ev });
        p.amounts.push({ kind: 'fullCost', fiscalYear: 2019, amountYen: yen(tFix), rawValue: tFix, rawUnit: '円', evidence: ev });
      }
    }

    // Indicators: one outcome line after the 実施形態 line, and a single 活動指標 directly after it.
    const lines = block.split('\n'), first = lines.findIndex(l => l.startsWith('令和元年度実績'));
    const val = (l: string) => l.match(/^令和元年度実績：\s*([0-9０-９][0-9０-９,，.．]*)\s*([^\s0-9０-９、，,（(]{1,6})$/);
    if (first >= 2 && FORM.test(lines[first - 2]) && lines[first - 2].length <= 30 && !/活動指標/.test(lines[first - 1])) {
      const v = val(lines[first]), raw = `${lines[first - 1]}\n${lines[first]}`;
      if (v && lines[first - 1].trim() && lines[first - 1].trim() !== '設定なし')
        p.indicators.push({ name: lines[first - 1].trim(), fiscalYear: 2019, target: null, actual: v[1], unit: v[2], evidence: at(raw) });
      const act = lines[first + 1]?.match(/^[（(]活動指標１[）)](.+)$/), av = lines[first + 2] ? val(lines[first + 2]) : null;
      if (act && av && !block.includes('活動指標２'))
        p.indicators.push({ name: act[1].trim(), fiscalYear: 2019, target: null, actual: av[1], unit: av[2], evidence: at(`${lines[first + 1]}\n${lines[first + 2]}`) });
    }
    p.warnings.push('評価表の表題は「令和元年度」のみで、評価実施年度は本文に明示がないため未設定（対象年度=令和元年度）。必要性・効率性の評語と強化/改良/改善戦略の区分は段組み崩れで項目との対応が確定できないため未収録。金額は予算額・決算額（令和元年度）と、直接事業費＋人件費＝総額の検算が予定値・確定値とも一致した場合のみ確定値の人件費・総額を収録（確定値の人件費は原文上「R2 事務分担表による人数」に基づく）。指標は実績値が単一の数値＋単位の行のみ。r2hyoka.pdf の一覧から既に構造化済みの事業名は重複を避けて除外。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '11215': { extract, scope: '狭山市 令和元年度 事務事業評価表（個票PDF）のうち評価一覧で未構造化の事業。事業コード・名称・所属、方向性（第一次）、予算・決算・人件費・総額、単一値の成果/活動指標。必要性・効率性の評語と見出し崩れ票は対象外。' },
};
