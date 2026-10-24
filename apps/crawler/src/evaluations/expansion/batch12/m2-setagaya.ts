import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 世田谷区 令和元年度 事務事業評価（平成30年度決算）評価票
const R1_TITLE = '令和元年度\n事務事業評価（平成30年度決算）評価票\n';
const SHEET = '\n事務事業評価票\n';
// 「事務事業に係るフルコスト（千円）」欄。この並びで読め、費用＝人件費＋物件費＋その他、フルコスト＝費用－収入＋間接コスト（±1千円）が成り立つ票のみ採用。
const COST = /\nフルコスト\n([\d,]+)\n収入\n([\d,]+)\n費用\n([\d,]+)\n事務分担割合\n[\d.]+\n人件費\n([\d,]+)\n物件費\n([\d,]+)\nその他\n([\d,]+)\n間接コスト\n([\d,]+)\n/;
const n = (s: string) => Number(s.replace(/,/g, ''));

function r1Sheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(R1_TITLE)) return [];
  const out: ProjectEvaluation[] = [];
  const starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i + 1);
  starts.forEach((s, k) => {
    const body = t.slice(s, starts[k + 1] ?? t.length);
    const head = body.split('\n').filter(l => l.trim()).slice(0, 10);
    const names = head.map(l => /^(\d+(?:[～、]\s?\d+)?) (\S.*)$/.exec(l)).filter(m => m !== null);
    if (names.length !== 1) return;
    const [line, code, name] = names[0]!;
    const deps = head.filter(l => l !== line && /^[^\s、。（）]{2,20}課$/.test(l));
    const nameAt = s + body.indexOf(`\n${line}\n`) + 1;
    const p = project(input, code, name.trim(), 2019, line, nameAt);
    p.evaluatedFiscalYear = 2018;
    p.evidence.push(evidence(input, R1_TITLE.slice(0, -1), 0));
    if (deps.length === 1) { p.department = deps[0]; p.evidence.push(evidence(input, deps[0], s + body.indexOf(`\n${deps[0]}\n`) + 1)); }
    const dir = /\n今後の方向性\n〇([^\n]+)\n/.exec(body);
    if (dir) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[1].trim(), scale: null, evidence: evidence(input, dir[0].slice(1, -1), s + dir.index + 1) });
    const c = COST.exec(body);
    if (c) {
      const [full, income, cost, personnel, goods, other, indirect] = c.slice(1).map(n);
      if (Math.abs(cost - personnel - goods - other) <= 1 && Math.abs(full - (cost - income + indirect)) <= 1) {
        const raw = c[0].slice(1, -1), at = s + c.index + 1;
        p.amounts.push(amount(input, 'fullCost', 2018, c[1], '千円', raw, at), amount(input, 'personnel', 2018, c[4], '千円', raw, at));
        p.warnings.push('金額は「事務事業に係るフルコスト（千円）」欄の平成30年度決算ベースのフルコスト（費用－収入＋間接コスト）と人件費。費用内訳と検算が一致した票のみ収録。');
      }
    }
    if (!p.amounts.length) p.warnings.push('フルコスト欄の値の並びが抽出テキストで崩れている（または検算が合わない）ため金額は未収録。');
    p.warnings.push('令和元年度 事務事業評価（平成30年度決算）評価票。評価年度は表紙の「令和元年度」、評価対象年度は「平成30年度決算」による。番号は評価対象一覧の№（複数の予算事業をまとめた票は「7～9」等）。成果指標・行動量は列の対応が抽出テキストで確定しないため未収録。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 世田谷区 令和４年度事務事業評価（令和元年度評価の３年後再評価）対象事業一覧
const R4_TITLE = '令和４年度事務事業評価の評価結果について\n（令和元年度事務事業評価の３年後再評価）\n';
function r4List(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(R4_TITLE)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n№(\d+)\n\n【(?:事業名|対象事業)】([^\n]+)\n\n【所管課】([^\n]+)\n/g)) {
    const p = project(input, `R4-${m[1]}`, m[2].trim(), 2022, m[0].slice(1, -1), m.index! + 1);
    p.department = m[3].trim();
    p.evidence.push(evidence(input, R4_TITLE.slice(0, -1), 0));
    p.warnings.push('令和４年度事務事業評価（令和元年度事務事業評価の３年後再評価）の対象事業一覧の事業名・所管課のみ。評価年度は表題の「令和４年度」。前回評価結果・取組み成果・今後の方向性は文章のため、後続の評価票（No.N）は列が抽出テキストで崩れているため未収録。');
    out.push(p);
  }
  return out;
}

export const setagayaEntries: Record<string, Entry> = {
  '13112': {
    extract: municipality(i => [...r1Sheets(i), ...r4List(i)], p => `${p.evaluationYear}:${p.projectCode}`),
    scope: '世田谷区 令和元年度 事務事業評価（平成30年度決算）評価票の評価対象ごとの事業名・評価番号・所管課・今後の方向性と、検算が一致したフルコスト・人件費（千円）、および令和４年度事務事業評価（３年後再評価）対象事業一覧の事業名・所管課。新実施計画事業・重点政策の施策評価、評価一覧表、見方、成果指標は対象外。',
  },
};
