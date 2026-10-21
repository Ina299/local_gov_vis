import type { EvaluationAmount, EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 墨田区 令和８年度 施策評価シート PDF 内の「事務事業評価シート」（1事業1枚）。補助金評価シート・施策欄は対象外。 */
const N = '(△?[\\d,]+)', R = '([^\\n]*%)';
const num = (s: string) => (s.startsWith('△') ? -1 : 1) * Number(s.replace(/[△,]/g, ''));
const years3 = (labels: string) => `${labels}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${R}\\n${R}\\n${R}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n${N}\\n`;
// 予算・決算額推移（人コストあり様式）: 令和3年度は縦、4〜6年度は3列、7・8年度は2列（8年度の人コスト・総事業費は空欄）。
const BUDGET = new RegExp('予算・決算額推移（単位：千円）\\n令和３年度\\n予算現額（令和８年度は当初予算）\\n' + N + '\\nA\\.決算額（令和８年度は見込み）\\n' + N + '\\n国\\n' + N + '\\n財\\n源\\n都\\n' + N + '\\nその他\\n' + N + '\\n一般財源\\n' + N + '\\n執行率（％）\\n' + R + '\\nB\\.人コスト\\n' + N + '\\n総事業費（A\\+B）\\n' + N + '\\n予算書P（令和８年度）\\n[^\\n]*\\n\\n'
  + years3('令和４年度\\n令和５年度\\n令和６年度') + '執行実績報告書P（令和７年度）\\n\\n令和７年度\\n令和８年度\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + N + '\\n' + R + '\\n' + R + '\\n' + N + '\\n' + N + '\\n');
const HEAD = /(?:^|\n)(\d{3}) [^\n]+\n([^\n]+)\n([^\n]+)\n電話番号（内線）/g;
const RESULTS = '現状維持|改善・見直しのうえ継続|統合や縮小を検討|廃止を検討|拡充|休止|終了';
const RATING_A = new RegExp(`\\n評価結果\\n(${RESULTS})\\n\\n(?:\\d+\\n\\n)?評価についての説明`, 'g');
const RATING_B = new RegExp(`評価結果\\n\\n評価についての説明・今後の方向性等\\n[^]*?\\n\\n(${RESULTS})\\n\\n課題・問題点`, 'g');
const T = '([^\\n]+)';
const INDICATOR = new RegExp(`指 標\\n([^\\n]+)\\n((?:(?!指 標|\\nR2\\n)[^]){0,400})\\nR2\\n\\nR3\\n\\nR4\\n\\nR5\\n\\nR6\\n\\nR7\\n\\n目標\\n\\n${Array(6).fill(T).join('\\n\\n')}\\n\\n実績\\n\\n${Array(7).fill(T).join('\\n\\n')}\\n\\n(?:手 段 に|目 的 に)`, 'g');

interface Sheet { input: CachedInput; start: number; raw: string; name: string; dept: string; measure: string; key: string; values: string; p: ProjectEvaluation }

function sheets(input: CachedInput): Sheet[] {
  // 111〜131 は既存構造化済みの資料（batch7 以前の取得）なので対象外。
  if (input.municipalityCode !== '13107' || input.format !== 'pdf' || /\/r8hyouka\.files\/(111|112|121|122|123|131)\.pdf$/.test(input.sourceUrl) ||!/^施策[０-９]{3}\s/.test(input.text) || !input.text.slice(0, 400).includes('施策評価シート')) return [];
  const text = input.text, out: Sheet[] = [];
  const starts = [...text.matchAll(/\n令和８年度\n(?:施\n策\n事 業 名|補助金名)/g)].map(m => m.index!);
  starts.forEach((s, k) => {
    const end = starts[k + 1] ?? text.length, seg = text.slice(s, end);
    if (!seg.includes('事務事業評価シート') || seg.includes('補助金評価シート')) return;
    const heads = [...seg.matchAll(HEAD)];
    if (heads.length !== 1) return;
    const h = heads[0], measure = h[1], name = h[2].trim(), dept = h[3].trim();
    if (!/(課|室|所|センター|館|局|担当)$/.test(dept) || !text.startsWith(`施策${measure.replace(/\d/g, d => String.fromCharCode(0xff10 + Number(d)))}`)) return;
    const hStart = s + h.index! + (h[0].startsWith('\n') ? 1 : 0), hRaw = h[0].replace(/^\n/, '');
    const p = project(input, `${measure}:${dept}:${name}`, name, 2026, hRaw, hStart);
    p.department = dept; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, '令和８年度\n施\n策\n事 業 名', s + 1));
    const ratings = [...seg.matchAll(RATING_A), ...seg.matchAll(RATING_B)];
    if (ratings.length === 1) {
      const r = ratings[0];
      p.ratings.push({ kind: 'self', label: '評価結果', value: r[1], scale: null, evidence: evidence(input, r[0], s + r.index!) });
    } else if (ratings.length > 1) p.warnings.push('評価結果の記載が票内に複数あり対応を確定できないため評価結果は未収録。');
    const budgets = [...seg.matchAll(new RegExp(BUDGET.source, 'g'))];
    if (budgets.length === 1) {
      const b = budgets[0], v = b.slice(1), ev = evidence(input, b[0], s + b.index!);
      // 列: R3(予算,決算,国,都,他,一般,率,人,総) / R4-6 各行3列 / R7・R8 各行2列（人・総はR7のみ）
      const year = (y: number) => {
        if (y === 2021) return { budget: v[0], actual: v[1], fin: [v[2], v[3], v[4], v[5]], person: v[7], total: v[8] };
        if (y >= 2022 && y <= 2024) { const c = y - 2022, row = (r: number) => v[9 + r * 3 + c]; return { budget: row(0), actual: row(1), fin: [row(2), row(3), row(4), row(5)], person: row(7), total: row(8) }; }
        const row = (r: number) => v[36 + r * 2]; return { budget: row(0), actual: row(1), fin: [row(2), row(3), row(4), row(5)], person: v[50], total: v[51] };
      };
      const amounts: EvaluationAmount[] = [];
      let ok = true;
      for (const y of [2021, 2022, 2023, 2024, 2025]) {
        const c = year(y);
        if (num(c.fin[0]) + num(c.fin[1]) + num(c.fin[2]) + num(c.fin[3]) !== num(c.actual) || num(c.actual) + num(c.person) !== num(c.total)) { ok = false; break; }
        if (num(c.budget) === 0 && num(c.actual) === 0 && num(c.person) === 0) continue;
        const add = (kind: EvaluationAmount['kind'], raw: string) => amounts.push({ kind, fiscalYear: y, amountYen: num(raw) * 1000, rawValue: raw, rawUnit: '千円', evidence: ev });
        add('budget', c.budget); add('actual', c.actual); add('personnel', c.person); add('fullCost', c.total);
      }
      if (ok) {
        if (num(v[37]) !== 0) amounts.push({ kind: 'budget', fiscalYear: 2026, amountYen: num(v[37]) * 1000, rawValue: v[37], rawUnit: '千円', evidence: ev });
        p.amounts.push(...amounts);
      } else p.warnings.push('予算・決算額推移の財源内訳・総事業費の合計が一致しない列があり、列対応を確定できないため金額は未収録。');
    } else p.warnings.push('予算・決算額推移表の列対応を確定できない様式のため金額は未収録。');
    for (const m of seg.matchAll(INDICATOR)) {
      const target = m[8], actual = m[14], ev = evidence(input, m[0], s + m.index!);
      if (target.includes(' ') || actual.includes(' ')) continue;
      const unit = m[2].match(/^単 位\n([^\n]+)\n最終目標値\n/) ?? m[2].match(/\n単 位\nH30\n\n([^\n]+)\nH31\n/);
      const ind: EvaluationIndicator = { name: m[1].trim(), fiscalYear: null, target, actual, unit: unit?.[1].trim() ?? null, evidence: ev };
      p.indicators.push(ind);
    }
    p.warnings.push('墨田区施策評価シート内の事務事業評価シートから収録。金額は予算・決算額推移（千円）のうち財源内訳の合計＝決算額、決算額＋人コスト＝総事業費が一致した場合のみ。予算は予算現額（令和８年度は当初予算）、令和８年度の決算見込みは未収録。予算・決算・人コストがすべて0の年度は未収録。指標は「R7」列の目標・実績のみで、表記がR7のため会計年度か確定せず年度は未設定。');
    const key = `${dept}\n${name}`;
    const values = JSON.stringify([p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => r.value), p.indicators.map(i => [i.name, i.target, i.actual])]);
    out.push({ input, start: hStart, raw: hRaw, name, dept, measure, key, values, p });
  });
  return out;
}

// 既存構造化データと同名・同年度で衝突するもの（新規側を除外）。
const EXCLUDED = new Set<string>([]);
let cache: { inputs: CachedInput[]; byInput: Map<string, ProjectEvaluation[]> } | null = null;

export function extractSumida(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13107') return [];
  if (!cache || cache.inputs !== inputs) {
    const groups = new Map<string, Sheet[]>();
    for (const i of inputs) for (const s of sheets(i)) groups.set(s.key, [...(groups.get(s.key) ?? []), s]);
    const byInput = new Map<string, ProjectEvaluation[]>();
    for (const [key, list] of groups) {
      if (EXCLUDED.has(key) || new Set(list.map(s => s.values)).size > 1) continue;
      const [first, ...rest] = list;
      for (const r of rest) first.p.evidence.push(evidence(r.input, r.raw, r.start));
      if (rest.length) first.p.warnings.push('複数の施策評価シートに同一事業・同一内容の事務事業評価シートが再掲されているため1件に統合。');
      byInput.set(first.input.sourceId, [...(byInput.get(first.input.sourceId) ?? []), first.p]);
    }
    cache = { inputs, byInput };
  }
  return cache.byInput.get(input.sourceId) ?? [];
}

export const entries = {
  '13107': { extract: extractSumida, scope: '令和８年度施策評価シートに収録された事務事業評価シート（1事業1枚）から事業名・主管課・評価結果・予算決算額推移（合計検算一致時のみ）・指標のR7列を構造化。施策評価本体、補助金評価シート、施策内事務事業一覧表は対象外。' },
};
