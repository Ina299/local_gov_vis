/** Batch-12 (m6) extractor for 01397 留寿都村: 第６次総合計画実施計画 令和３〜６年度事業評価結果の「総合計画実施計画事業評価調書」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { amount, mergeReprints, nfkc, num } from '../batch9/i1-util';

/** 令和３・４年度版は複数年度（Ｒ３〜Ｒ６）の事業費欄を持つ様式、令和５・６年度版は単年度の様式. */
const REPORTS: Record<string, number> = { '88b5cc1638c71097bc0f5336': 3, '89121cfe10b5622d53809720': 4, e83505c3593c08805e37712b: 5, '93365bc62d124f3f69c6a9c3': 6 };
const SHEET = '総合計画実施計画事業評価調書';
const DEPT = /(?:課|消防|教育委員会|診療所|子どもセンター)$/;

const NEED = ['必要である', 'どちらともいえない', '必要でない'];
const EFFECT = ['見直す必要はない', '若干見直す必要がある', '全面的に見直し'];
const EFFICIENCY = ['余地はない', '余地は小さい', '余地は大きい'];
const QUESTIONS: { q: RegExp; label: string; values: string[] }[] = [
  { q: /１．総合計画の目標達成のために必要な事業か\n\n([^\n]+)\n/g, label: '必要性１（総合計画の目標達成のために必要な事業か）', values: NEED },
  { q: /２．住民サービスの向上のために必要な事業か\n\n([^\n]+)\n/g, label: '必要性２（住民サービスの向上のために必要な事業か）', values: NEED },
  { q: /１．達成目標(?:値（指標）)?に対して見直しをする必要があるか（余地があるか）\n\n([^\n]+)\n/g, label: '有効性１（達成目標に対して見直しをする必要があるか）', values: EFFECT },
  { q: /２．事業の目的に対して手段（活動内容）を見直す必要があるか\n\n([^\n]+)\n/g, label: '有効性２（事業の目的に対して手段（活動内容）を見直す必要があるか）', values: EFFECT },
  { q: /１．コスト削減の面で改善の余地があるか\n\n([^\n]+)\n/g, label: '効率性１（コスト削減の面で改善の余地があるか）', values: EFFICIENCY },
  { q: /２．業務効率性向上の観点から改善の余地があるか\n\n([^\n]+)\n/g, label: '効率性２（業務効率性向上の観点から改善の余地があるか）', values: EFFICIENCY },
];

function one(input: CachedInput): ProjectEvaluation[] {
  const reiwa = REPORTS[input.sourceId];
  if (input.municipalityCode !== '01397' || !reiwa) return [];
  const t = input.text;
  // The R4 report prints Kangxi radicals / compatibility ideographs (⾒, ⼩ …); mapping only those keeps character offsets.
  const n = t.replace(/[⼀-⿟豈-﫿]/g, c => { const x = c.normalize('NFKC'); return x.length === 1 ? x : c; });
  const R = '０１２３４５６７８９'[reiwa];
  const title = `令和${R}年度事業評価結果`;
  if (!t.slice(0, 40).includes(title)) return [];
  const year = 2018 + reiwa;
  const starts = [...t.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  const found: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length), ns = n.slice(s, starts[k + 1] ?? t.length);
    const no = sheet.match(/\n(\d{3}(?:-\d+)?)\n/);
    if (!no || no.index! > 60) return;
    const head = sheet.slice(0, Math.max(0, sheet.indexOf('総合計画上の位置づけ')));
    if (!head) return;
    const fy = sheet.match(new RegExp(`【令和${R}年度事業】`));
    if (!fy) return;
    const names = [...head.matchAll(/予算ＩＤ\n\n([^\n]+)\n会計区分/g), ...head.matchAll(/事業名\n\n([^\n]+)\n\n予算科目/g)];
    const depts = [...head.matchAll(/\n([^\n]+)\n\n担当部署\n/g)].filter(m => DEPT.test(m[1]));
    if (names.length !== 1 || depts.length !== 1) return;
    const name = names[0][1];
    if (/^\d|予算|担当|会計/.test(name)) return;
    const p = project(input, no[1], name, null, names[0][0], s + names[0].index!);
    p.department = depts[0][1];
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, no[1], s + no.index! + 1), evidence(input, depts[0][1], s + depts[0].index! + 1), evidence(input, fy[0], s + fy.index!));
    for (const { q, label, values } of QUESTIONS) {
      const ms = [...ns.matchAll(q)];
      if (ms.length !== 1 || !values.includes(ms[0][1])) continue;
      const raw = sheet.slice(ms[0].index!, ms[0].index! + ms[0][0].length - 1);
      p.ratings.push({ kind: 'self', label, value: raw.split('\n\n').pop()!, scale: values.join('／'), evidence: evidence(input, raw, s + ms[0].index!) });
    }
    if (reiwa >= 5) {
      // 事業費（千円）: 事業費計 is the left-most column, so it is printed first after the row label.
      const m = sheet.match(/当初予算額((?:\n\n[\d,]+)+)\n\n決算額((?:\n\n[\d,]+)+)\n/);
      if (m && sheet.includes('事業費（千円）')) {
        const b = m[1].split('\n\n').slice(1), a = m[2].split('\n\n').slice(1);
        const ok = (xs: string[]) => xs.every(x => num(x) <= num(xs[0]));
        if (b.length === a.length && b.length <= 2 && ok(b) && ok(a) && (sheet.match(/当初予算額/g) ?? []).length === 1 && (sheet.match(/決算額/g) ?? []).length === 1) {
          const raw = m[0].trimEnd(), at = s + m.index!;
          p.amounts.push(amount(input, 'budget', year, b[0], '千円', raw, at), amount(input, 'actual', year, a[0], '千円', raw, at));
        }
      }
    }
    p.warnings.push(`留寿都村 第６次総合計画実施計画 令和${reiwa}年度事業評価結果の事業評価調書。評価対象年度は調書の【令和${reiwa}年度事業】による。評価年度（実施年）は資料に明示がないため未設定。`);
    p.warnings.push('チェック項目（必要性・有効性・効率性）は設問文の直後に原文の選択肢が出力されているものだけ採用（設問と回答が離れて出力された項目は未収録）。');
    p.warnings.push(reiwa >= 5
      ? '事業費（千円）は「当初予算額」「決算額」の直後に同数の値が並び、先頭（事業費計の列）が最大となる場合だけ採用。財源内訳は列の対応を確定できないため未収録。'
      : '令和３・４年度版の事業費欄はＲ３〜Ｒ６の複数年度の当初予算額・決算額が並び列の対応を確定できないため金額は未収録。指標（計画値・実績値）の表も列の対応を確定できないため未収録。');
    found.push(p);
  });
  return mergeReprints(found, p => `${nfkc(p.projectName)}|${p.department}|${p.evaluatedFiscalYear}`);
}

export const rusutsuEntries = {
  '01397': {
    extract: one,
    scope: '第６次総合計画実施計画 令和３〜６年度事業評価結果の事業評価調書ごとの事業番号・事業名・担当部署・評価対象年度、チェック項目６問の回答（原文の選択肢）、令和５・６年度版の事業費計（当初予算額・決算額、千円）。総評・事業の成果の文章、財源内訳、令和３・４年度版の複数年度事業費欄と指標表、事業番号一覧、令和７年度版（既存構造化済み）は対象外。',
  },
};
