/** Batch-12 (m6-f5) extractor for 13107 墨田区: 令和７年度 施策評価シート PDF 内の「事務事業評価シート」（1事業1枚）。 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// Same sheet layout as the 令和８年度 extractor (batch7/g5-sumida.ts), one year earlier.
const N = '(△?[\\d,]+)', R = '([^\\n]*%)';
const num = (s: string) => (s.startsWith('△') ? -1 : 1) * Number(s.replace(/[△,]/g, ''));
const cols = (n: number, p: string) => Array(n).fill(p).join('\\n');
// 予算・決算額推移: 令和２年度は縦、3〜5年度は3列、6・7年度は2列（7年度の人コスト・総事業費は空欄）。
const BUDGET = new RegExp('予算・決算額推移（単位：千円）\\n令和２年度\\n予算現額（令和７年度は当初予算）\\n' + N + '\\nA\\.決算額（令和７年度は見込み）\\n' + N + '\\n国\\n' + N + '\\n財\\n源\\n都\\n' + N + '\\nその他\\n' + N + '\\n一般財源\\n' + N + '\\n執行率（％）\\n' + R + '\\nB\\.人コスト\\n' + N + '\\n総事業費（A\\+B）\\n' + N + '\\n予算書P（令和７年度）\\n[^\\n]*\\n\\n'
  + '令和３年度\\n令和４年度\\n令和５年度\\n' + cols(18, N) + '\\n' + cols(3, R) + '\\n' + cols(6, N) + '\\n'
  + '執行実績報告書P（令和６年度）\\n\\n令和６年度\\n令和７年度\\n' + cols(12, N) + '\\n' + R + '\\n' + R + '\\n' + N + '\\n' + N + '\\n', 'g');
// Layout B prints the row labels first, then 令和２年度 as one column with its page reference.
const BUDGET_B = new RegExp('予算・決算額推移（単位：千円）\\n予算現額（令和７年度は当初予算）\\nA\\.決算額（令和７年度は見込み）\\n国\\n財\\n源\\n都\\nその他\\n一般財源\\n執行率（％）\\nB\\.人コスト\\n総事業費（A\\+B）\\n予算書P（令和７年度）\\n[^\\n]*\\n\\n令和２年度\\n'
  + cols(6, N) + '\\n' + R + '\\n' + N + '\\n' + N + '\\n[^\\n]*\\n\\n'
  + BUDGET.source.slice(BUDGET.source.indexOf('令和３年度')), 'g');
const HEAD = /(?:^|\n)(\d{3}) [^\n]+\n([^\n]+)\n([^\n]+)\n電話番号（内線）/g;
const RESULTS = '現状維持|改善・見直しのうえ継続|統合や縮小を検討|廃止を検討|拡充|休止|終了';
const RATING_A = new RegExp(`\\n評価結果\\n(${RESULTS})\\n\\n(?:\\d+\\n\\n)?評価についての説明`, 'g');
const RATING_B = new RegExp(`評価結果\\n\\n(?:\\d+\\n\\n)?評価についての説明・今後の方向性等\\n[^]*?\\n\\n(${RESULTS})\\n\\n課題・問題点`, 'g');

interface Sheet { input: CachedInput; start: number; raw: string; key: string; values: string; p: ProjectEvaluation }

function sheets(input: CachedInput): Sheet[] {
  if (input.municipalityCode !== '13107' || input.format !== 'pdf' || !/\/R7_gyousei_hyouka\.files\/r7-\d{3}\.pdf$/.test(input.sourceUrl)) return [];
  const text = input.text, doc = text.slice(0, 400).match(/^令和７年度\n基本目標\n\n施策評価シート\n[^]*?\n施 策\n\n(\d{3}) /);
  if (!doc) return [];
  const out: Sheet[] = [];
  const starts = [...text.matchAll(/\n令和７年度\n(?:施\n策\n事 業 名|補助金名)/g)].map(m => m.index!);
  starts.forEach((s, k) => {
    const seg = text.slice(s, starts[k + 1] ?? text.length);
    if (!seg.includes('事務事業評価シート') || seg.includes('補助金評価シート')) return;
    const heads = [...seg.matchAll(HEAD)];
    if (heads.length !== 1) return;
    const h = heads[0], measure = h[1], name = h[2].trim(), dept = h[3].trim();
    if (measure !== doc[1] || !/(課|室|所|センター|館|局|担当)$/.test(dept)) return;
    const hStart = s + h.index! + (h[0].startsWith('\n') ? 1 : 0), hRaw = h[0].replace(/^\n/, '');
    const p = project(input, `${measure}:${dept}:${name}`, name, 2025, hRaw, hStart);
    p.department = dept; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, '令和７年度\n施\n策\n事 業 名', s + 1));
    const ratings = [...seg.matchAll(RATING_A), ...seg.matchAll(RATING_B)];
    if (ratings.length === 1) {
      const r = ratings[0];
      p.ratings.push({ kind: 'self', label: '評価結果', value: r[1], scale: null, evidence: evidence(input, r[0], s + r.index!) });
    } else if (ratings.length > 1) p.warnings.push('評価結果の記載が票内に複数あり対応を確定できないため評価結果は未収録。');
    const budgets = [...seg.matchAll(BUDGET), ...seg.matchAll(BUDGET_B)];
    if (budgets.length === 1) {
      const b = budgets[0], v = b.slice(1), ev = evidence(input, b[0], s + b.index!);
      // 列: R2(予算,決算,国,都,他,一般,率,人,総) / R3-5 各行3列 / R6・R7 各行2列（人・総はR6のみ）
      const year = (y: number) => {
        if (y === 2020) return { budget: v[0], actual: v[1], fin: [v[2], v[3], v[4], v[5]], person: v[7], total: v[8] };
        if (y >= 2021 && y <= 2023) { const c = y - 2021, row = (r: number) => v[9 + r * 3 + c]; return { budget: row(0), actual: row(1), fin: [row(2), row(3), row(4), row(5)], person: row(7), total: row(8) }; }
        const row = (r: number) => v[36 + r * 2]; return { budget: row(0), actual: row(1), fin: [row(2), row(3), row(4), row(5)], person: v[50], total: v[51] };
      };
      const amounts: EvaluationAmount[] = [];
      let ok = true;
      for (const y of [2020, 2021, 2022, 2023, 2024]) {
        const c = year(y);
        if (num(c.fin[0]) + num(c.fin[1]) + num(c.fin[2]) + num(c.fin[3]) !== num(c.actual) || num(c.actual) + num(c.person) !== num(c.total)) { ok = false; break; }
        if (num(c.budget) === 0 && num(c.actual) === 0 && num(c.person) === 0) continue;
        const add = (kind: EvaluationAmount['kind'], raw: string) => amounts.push({ kind, fiscalYear: y, amountYen: num(raw) * 1000, rawValue: raw, rawUnit: '千円', evidence: ev });
        add('budget', c.budget); add('actual', c.actual); add('personnel', c.person); add('fullCost', c.total);
      }
      if (ok) {
        if (num(v[37]) !== 0) amounts.push({ kind: 'budget', fiscalYear: 2025, amountYen: num(v[37]) * 1000, rawValue: v[37], rawUnit: '千円', evidence: ev });
        p.amounts.push(...amounts);
      } else p.warnings.push('予算・決算額推移の財源内訳・総事業費の合計が一致しない列があり、列対応を確定できないため金額は未収録。');
    } else p.warnings.push('予算・決算額推移表の列対応を確定できない様式のため金額は未収録。');
    p.warnings.push('墨田区 令和７年度 施策評価シート内の事務事業評価シートから収録。金額は予算・決算額推移（千円）のうち財源内訳の合計＝決算額、決算額＋人コスト＝総事業費が一致した場合のみ。予算は予算現額（令和７年度は当初予算）、令和７年度の決算見込みは未収録。予算・決算・人コストがすべて0の年度は未収録。指標表はR7列の実績が空欄で最終目標値と列が隣接し対応を確定できないため未収録。');
    const values = JSON.stringify([p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => r.value)]);
    out.push({ input, start: hStart, raw: hRaw, key: `${dept}\n${name}`, values, p });
  });
  return out;
}

let cache: { inputs: CachedInput[]; byInput: Map<string, ProjectEvaluation[]> } | null = null;

export function extractSumidaR7(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13107') return [];
  if (!cache || cache.inputs !== inputs) {
    const groups = new Map<string, Sheet[]>();
    for (const i of inputs) for (const s of sheets(i)) groups.set(s.key, [...(groups.get(s.key) ?? []), s]);
    const byInput = new Map<string, ProjectEvaluation[]>();
    for (const list of groups.values()) {
      // A business printed with different values in two sheets is dropped entirely.
      if (new Set(list.map(s => s.values)).size > 1) continue;
      const [first, ...rest] = list;
      for (const r of rest) first.p.evidence.push(evidence(r.input, r.raw, r.start));
      if (rest.length) first.p.warnings.push('複数の施策評価シートに同一事業・同一内容の事務事業評価シートが再掲されているため1件に統合。');
      byInput.set(first.input.sourceId, [...(byInput.get(first.input.sourceId) ?? []), first.p]);
    }
    cache = { inputs, byInput };
  }
  return cache.byInput.get(input.sourceId) ?? [];
}
