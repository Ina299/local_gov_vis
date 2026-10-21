import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe, num } from './g7-util';

const REIWA = 2018;
const V = '[-－ー―\\d,.]+';
const nullish = (s: string) => /^[-－ー―]$/.test(s) ? null : s;

/** 和光市 事務事業評価表（目標像別PDF）。事務事業一覧・案内ページは対象外。 */
export function extractWako(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11229' || !input.sourceUrl.includes('/_page_/001/013/996/') || input.format !== 'pdf') return [];
  const heads = [...input.text.matchAll(/(?<=^|\n)事業名\n款\n\n([^\n]+)\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = input.text.slice(start, heads[i + 1]?.index ?? input.text.length);
    const name = h[1].trim();
    if (/^\d+ \S+費$/.test(name) || name === '予算事業コード' || !seg.includes('PLAN') || !seg.includes('２．事業の実績')) continue;
    // Header region: department and the 7-digit 予算事業コード are kept only when unambiguous.
    const headEnd = seg.indexOf('事業の対象');
    const head = seg.slice(0, headEnd > 0 ? headEnd : 0);
    const codes = [...new Set([...head.matchAll(/\n(\d{7})\n/g)].map(m => m[1]))];
    const p = project(input, codes.length === 1 ? codes[0] : `name:${name}`, name, null, h[0].trimEnd(), start);
    p.projectCode = null;
    if (codes.length === 1) {
      p.projectCode = codes[0];
      const at = head.indexOf(`\n${codes[0]}\n`) + 1;
      p.evidence.push(evidence(input, codes[0], start + at));
    }
    const depts = [...head.matchAll(/\n([^\s\n]+(?:課|室|局))\n/g)].filter(m => !['課室名', '部局名'].includes(m[1]));
    if (new Set(depts.map(m => m[1])).size === 1) {
      p.department = depts[0][1];
      p.evidence.push(evidence(input, depts[0][1], start + depts[0].index! + 1));
    }
    // 事業費: 予算額 (4 fiscal years + 不用額) and 決算額 (3 years); keep only when 不用額 or 執行率 reconciles.
    const cost = seg.match(new RegExp(`(\\d+)年度\\n\\n(\\d+)年度\\n\\n(\\d+)年度\\n\\n(\\d+)年度\\n\\n不用額\\n\\n予算額\\n\\n千円\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})(?:\\n\\n(${V}))?\\n\\n決算額\\n\\n千円\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n-\\n`));
    if (cost) {
      const ys = cost.slice(1, 5).map(Number), budget = cost.slice(5, 9), actual = cost.slice(10, 13);
      const consecutive = ys.every((y, k) => y === ys[0] + k);
      const b3 = nullish(budget[2]), a3 = nullish(actual[2]);
      let ok = false;
      if (cost[9] !== undefined && b3 && a3) ok = num(b3) - num(a3) === num(cost[9]);
      else if (b3 && a3) {
        const rate = seg.slice(cost.index! + cost[0].length).match(/^\n*執行率\n\n一般財源\n\n千円\n\n(?:[-\d,]+\n\n){4}(\d+\.\d)%\n/);
        ok = !!rate && num(b3) > 0 && (Math.round(num(a3) / num(b3) * 1000) / 10).toFixed(1) === rate[1];
      }
      if (consecutive && ok) {
        const raw = cost[0].trimEnd(), at = start + cost.index!;
        budget.forEach((v, k) => { if (nullish(v)) p.amounts.push(amount(input, 'budget', REIWA + ys[k], v, '千円', raw, at)); });
        actual.forEach((v, k) => { if (nullish(v)) p.amounts.push(amount(input, 'actual', REIWA + ys[k], v, '千円', raw, at)); });
      }
    }
    // 指標: header columns must be 3 実績値 + 2 目標値 + 最終目標; rows only when name, unit and six values are contiguous.
    const ih = seg.match(/(\d+)年度\n\n(\d+)年度\n\n(\d+)年度\n\n(\d+)年度\n\n(\d+)年度\n\n(\d+)年度\n\n実績値\n\n実績値\n\n実績値\n\n目標値\n\n目標値\n\n最終目標\n\n単位\n指標名\n/);
    const costAt = seg.indexOf('\n単位\n\n事\n業\n費');
    if (ih && costAt > ih.index!) {
      const y = ih.slice(1, 7).map(Number);
      if (y[0] + 1 === y[1] && y[1] + 1 === y[2] && y[2] === y[3] && y[3] + 1 === y[4]) {
        const body = seg.slice(ih.index! + ih[0].length, costAt), bodyAt = start + ih.index! + ih[0].length;
        for (const r of body.matchAll(new RegExp(`(?<=\\n|^)([^\\n]{2,})\\n\\n([^\\n\\d]{1,6})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})(?=\\n|$)`, 'g'))) {
          const [, iname, unit, ...v] = r;
          if (new RegExp(`^${V}$`).test(iname)) continue;
          const ev = evidence(input, r[0], bodyAt + r.index!);
          const rows: [number, string | null, string | null][] = [[y[0], null, nullish(v[0])], [y[1], null, nullish(v[1])], [y[2], nullish(v[3]), nullish(v[2])], [y[4], nullish(v[4]), null], [y[5], nullish(v[5]), null]];
          for (const [fy, target, actualV] of rows) if (target !== null || actualV !== null)
            p.indicators.push({ name: iname, fiscalYear: REIWA + fy, target, actual: actualV, unit, evidence: ev });
        }
      }
    }
    p.warnings.push('和光市事務事業評価表。年度欄は元号を省略した「N年度」表記で、本文の令和表記（令和7年度・令和8年3月31日等）と整合するため令和として換算。評価実施年度・評価対象年度は表に明示されないため未設定。');
    p.warnings.push('事業費は予算額（4年度分）・決算額（3年度分）を、不用額＝予算額−決算額または執行率が一致する場合のみ収録。指標は指標名・単位・6列の値が連続して並ぶ行のみ（最終目標は目標値として収録）。評価項目①〜⑩と今後の方向性はチェック記号が抽出テキストで判別できないため未収録。');
    out.push(p);
  }
  return dedupe(out, p => `${p.projectCode}\n${p.projectName}`);
}
