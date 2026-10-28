/**
 * 飯島町（20384）: 令和４〜７年度 行政評価書（内部評価）の事務事業評価シートから事業費（予算額・決算額、千円）を補強する。
 * シートの事業費欄は2か年（前年度・当該年度）を持つが、抽出テキストでは予算額・達成度・決算額の並びがシートごとに崩れ、
 * 1冊だけでは年度・種別を確定できない。そこで、ある年度の2つの金額が「その年度の評価書」と「翌年度の評価書」の同じ事業の
 * シートに共通して現れ、両冊で同じ順に並ぶ場合だけ採用し、先に現れる方を予算額、後を決算額とする（両冊とも表の列順は予算額→決算額）。
 * 翌年度の評価書がない年度（令和７年度の当該年度分）は確定できないため採らない。達成度・評価項目・今後の方向性・施策評価は対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

/** 令和４〜７年度 行政評価書（内部評価）（sourceId 先頭）→ 令和の年度。令和３年度版はシートの区切りが異なるため使わない。 */
const REPORTS: Record<string, number> = { '6311e3a822a1b2fce4a3d545': 4, '2b3a5ca5ebd4032f0d2a4650': 5, 'a544f56b778257a6b1462b6e': 6, 'bedfce21ecb4317408da1eee': 7 };
const SHEET = '事務事業評価\n基本情報';
const AMOUNT = /^(?:0|[1-9]\d{0,2}(?:,\d{3})*)$/;
const fw = (n: number) => String(n).replace(/\d/g, d => String.fromCharCode(0xff10 + Number(d)));

interface Sheet { code: string; name: string; nameRaw: string; nameAt: number; amounts: { value: string; at: number }[] }

/** One report's sheets by business code; codes printed on more than one sheet are dropped. */
function sheets(input: CachedInput, reiwa: number): Map<string, Sheet> {
  const t = input.text;
  const starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i);
  const byCode = new Map<string, Sheet | null>();
  starts.forEach((s, k) => {
    const end0 = t.indexOf('実施計画（施策）評価', s);
    const end = Math.min(starts[k + 1] ?? t.length, end0 < 0 ? t.length : end0);
    const region = t.slice(s, end);
    // The sheet's own two-year columns (前年度・当該年度), printed as separate lines; no other year may appear.
    const years = new Set([...region.matchAll(/(?<=\n)令和(.)年度(?=\n)/g)].map(m => m[1]));
    if (years.size !== 2 || !years.has(fw(reiwa - 1)) || !years.has(fw(reiwa))) return;
    const head = /\n(\d{4}) ([^\n]+)\n/.exec(region);
    if (!head) return;
    // Name continues on following lines until a blank, numeric, bullet or year line.
    const lines = [head[2]];
    let at = head.index + head[0].length;
    for (;;) {
      const nl = region.indexOf('\n', at);
      const line = region.slice(at, nl < 0 ? region.length : nl);
      if (!line || /^[\d,─]+$/.test(line) || /^[●令]/.test(line) || nl < 0) break;
      lines.push(line); at = nl + 1;
    }
    const nameRaw = region.slice(head.index + 1, at).replace(/\n$/, '');
    const name = lines.join('');
    // The summary table of the same report prints the code and the full name on separate lines; the sheet name must match it.
    if (!t.includes(`\n${head[1]}\n\n${name}\n`)) return;
    // Numeric cells of the sheet: amounts (comma-grouped yen thousands) and single-digit 達成度; page-number pairs are dropped.
    const cells = [...region.matchAll(/(?<=\n)([^\n]+)(?=\n)/g)].filter(m => /^(?:[\d,]+|─)$/.test(m[1]));
    const page = /\n\n(\d{1,3})\n\n\n(\d{1,3})\n/.exec(region);
    const pageAt = page ? [page.index + 2, page.index + 2 + page[1].length + 3] : [];
    const amounts = cells.filter(m => !pageAt.includes(m.index!) && AMOUNT.test(m[1]) && !/^[1-5]$/.test(m[1]))
      .map(m => ({ value: m[1], at: s + m.index! }));
    const code = head[1];
    byCode.set(code, byCode.has(code) ? null : { code, name, nameRaw, nameAt: s + head.index + 1, amounts });
  });
  return new Map([...byCode].filter((e): e is [string, Sheet] => e[1] !== null));
}

/** The two amounts of year `reiwa` (in report order): shared by the sheets of that year's and the next year's report. */
function yearPair(own: Sheet, next: Sheet): [number, number] | null {
  if (own.amounts.length !== 4 || next.amounts.length !== 4) return null;
  const a = own.amounts.map(x => x.value), b = next.amounts.map(x => x.value);
  // The current-year pair is the last two of the earlier report's year columns and the first two of the next report's;
  // without relying on positions, require exactly two values in common (as a multiset) and the same order in both.
  const rest = [...b];
  const shared: number[] = [];
  a.forEach((v, i) => { const j = rest.indexOf(v); if (j >= 0) { shared.push(i); rest[j] = '\u0000'; } });
  if (shared.length !== 2) return null;
  const [i, j] = shared;
  const bi = b.indexOf(a[i]), bj = a[i] === a[j] ? b.indexOf(a[j], bi + 1) : b.indexOf(a[j]);
  if (bi < 0 || bj < 0 || bi >= bj) return null;
  return [i, j];
}

const cache = new Map<string, Map<string, Sheet>>();
const sheetsOf = (input: CachedInput, reiwa: number) => {
  const key = `${input.sourceId}\u0000${input.sourceSha256}`;
  if (!cache.has(key)) cache.set(key, sheets(input, reiwa));
  return cache.get(key)!;
};

function iijima(input: CachedInput, all: CachedInput[]): ProjectEvaluation[] {
  const reiwa = REPORTS[input.sourceId];
  if (input.municipalityCode !== '20384' || !reiwa || input.truncated) return [];
  if (!input.text.startsWith(`令和${fw(reiwa)}年度\n行政評価書（内部評価）\n`)) return [];
  const report = (r: number) => {
    const id = Object.keys(REPORTS).find(k => REPORTS[k] === r);
    const doc = all.find(d => d.sourceId === id && !d.truncated && d.text.startsWith(`令和${fw(r)}年度\n行政評価書（内部評価）\n`));
    return doc ? sheetsOf(doc, r) : null;
  };
  const own = sheetsOf(input, reiwa), prev = report(reiwa - 1), next = report(reiwa + 1);
  const year = 2018 + reiwa;
  const out: ProjectEvaluation[] = [];
  for (const sh of own.values()) {
    const p = project(input, `sheet-${sh.code}`, sh.name, year, sh.nameRaw, sh.nameAt);
    p.projectCode = sh.code;
    p.evaluatedFiscalYear = year;
    const add = (pair: [number, number] | null, positions: (pair: [number, number]) => [number, number], fy: number) => {
      if (!pair) return;
      const [bi, ai] = positions(pair);
      for (const [kind, i] of [['budget', bi], ['actual', ai]] as const) {
        const cell = sh.amounts[i];
        p.amounts.push({ kind, fiscalYear: fy, amountYen: Number(cell.value.replace(/,/g, '')) * 1000, rawValue: cell.value, rawUnit: '千円',
          evidence: evidence(input, cell.value, cell.at) });
      }
    };
    // 当該年度分: confirmed by the next year's report.
    const n = next?.get(sh.code);
    if (n && n.name === sh.name) add(yearPair(sh, n), pr => pr, year);
    // 前年度分: confirmed by the previous year's report (positions taken in this report).
    const pv = prev?.get(sh.code);
    if (pv && pv.name === sh.name) {
      const pr = yearPair(pv, sh);
      if (pr) {
        const a = pv.amounts.map(x => x.value), b = sh.amounts.map(x => x.value);
        const bi = b.indexOf(a[pr[0]]), ai = a[pr[0]] === a[pr[1]] ? b.indexOf(a[pr[1]], bi + 1) : b.indexOf(a[pr[1]]);
        add(pr, () => [bi, ai], year - 1);
      }
    }
    if (!p.amounts.length) continue;
    p.warnings.push(`飯島町 令和${reiwa}年度 行政評価書（内部評価）の事務事業評価シートの事業費（千円）。年度・予算額/決算額の別は、同じ事業の前後年度の評価書のシートに同じ2つの金額が同じ順で現れることで確定したものだけ採用（先が予算額、後が決算額）。`);
    out.push(p);
  }
  return out;
}

export const entry = {
  extract: (input: CachedInput, all: CachedInput[]) => iijima(input, all),
  scope: '令和４〜７年度 行政評価書（内部評価）の事務事業評価シートの事業費（予算額・決算額、千円）。前後年度の評価書の同じ事業のシートで同じ金額・同じ順に現れる年度分のみ。令和７年度の当該年度分、達成度・評価項目・今後の方向性・施策評価は対象外。',
};
