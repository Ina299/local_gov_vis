import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, eraYear, municipality, num } from './g6-util';

const SHEET = '令和７年度事務事業評価シート';
const DEPT = /(課|室|局|所|署|センター)$/;
const DIRECTIONS = new Set(['現状維持', '改善', '縮小', '拡充', '廃止', '休止', '統合', '終了', '完了']);

/** 愛川町 令和7年度事務事業評価シート（R7shi-to.pdf）: one record per sheet. */
function parse(input: CachedInput): ProjectEvaluation[] {
  if (!input.text.startsWith(SHEET)) return [];
  const out: ProjectEvaluation[] = [];
  const starts = [...input.text.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? input.text.length, sheet = input.text.slice(start, end);
    let name: string | null = null, department: string | null = null, raw = '', at = -1;
    const a = /事業名\n\n([^\n]+)\n\n担当課\n\n([^\n]+)\n/.exec(sheet), b = /事業名\n\n担当課\n\n([^\n]+)\n\n([^\n]+)\n/.exec(sheet),
      c = /事業名\n\n担当課 ([^\n]+) 作成日\n\n([^\n]+)\n/.exec(sheet);
    if (a && DEPT.test(a[2]) && !DEPT.test(a[1])) { [name, department] = [a[1], a[2]]; raw = a[0]; at = a.index; }
    else if (b) {
      const [x, y] = [b[1], b[2]];
      if (DEPT.test(x) && !DEPT.test(y)) [name, department] = [y, x]; else if (DEPT.test(y) && !DEPT.test(x)) [name, department] = [x, y];
      raw = b[0]; at = b.index;
    } else if (c && DEPT.test(c[1])) { [name, department] = [c[2], c[1]]; raw = c[0]; at = c.index; }
    if (!name || !department) return;
    raw = raw.replace(/\n$/, '');
    const p = project(input, `${department}:${name}`, name, 2025, raw, start + at);
    p.department = department;
    p.evidence.push(evidence(input, SHEET, start));
    const cost = /基準年度（決算）\n令和(\S)年度（決算） 令和(\S)年度（決算） 令和(\S)年度（予算）\n（令和(\S)年度）((?:\s+[\d,.]+){16})/.exec(sheet);
    if (cost) {
      const years = [cost[4], cost[1], cost[2], cost[3]].map(n => eraYear('令和', n));
      const v = cost[5].trim().split(/\s+/), A = v.slice(0, 4), C = v.slice(8, 12), D = v.slice(12, 16);
      const ok = years.every(y => y !== null) && [0, 1, 2, 3].every(k => num(A[k]) + num(C[k]) === num(D[k]) && /^[\d,]+$/.test(A[k] + C[k] + D[k]));
      if (ok) {
        const craw = cost[0], cat = start + cost.index, seen = new Set<number>();
        // Column 0 is the 基準年度（決算） column; skip it when it repeats a later 決算 year.
        for (const k of [1, 2, 0, 3]) {
          const y = years[k]!;
          if (k === 0 && seen.has(y)) continue;
          seen.add(y);
          if (k === 3) { p.amounts.push(amount(input, 'budget', y, A[k], '円', craw, cat)); continue; }
          p.amounts.push(amount(input, 'actual', y, A[k], '円', craw, cat), amount(input, 'personnel', y, C[k], '円', craw, cat), amount(input, 'fullCost', y, D[k], '円', craw, cat));
        }
      } else p.warnings.push('事業費の推移表の列が「（Ｄ）＝（Ａ）＋（Ｃ）」で検算できないため金額は未採用。');
    }
    for (const [label, re] of [['自己評価（担当課） 評価結果', /６ 自己評価（担当課）\n評価結果\n\n(\S+)\n/], ['町の最終方針（行政改革推進本部会議） 評価結果', /１０ 町の最終方針（行政改革推進本部会議）\n評価結果\n\n(\S+)\n/]] as const) {
      const m = re.exec(sheet);
      if (m && DIRECTIONS.has(m[1])) p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0].replace(/\n$/, ''), start + m.index) });
    }
    p.warnings.push('愛川町 令和7年度事務事業評価シート。評価年度は表題の令和7年度。評価対象年度は表中に明示がないため未設定。',
      '事業費は（Ａ）事業費を決算年度は実績、令和7年度は予算として記録。人件費（Ｃ）と総事業費（Ｄ）は決算年度のみ記録し、（Ｄ）＝（Ａ）＋（Ｃ）で検算済み。',
      '成果指標・活動指標の表と1次・2次評価欄は抽出テキストで列対応が確定できないため未構造化。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '14401': { extract: municipality('14401', parse), scope: '令和7年度事務事業評価シート（R7shi-to.pdf）の各事業: 事業名・担当課・事業費/人件費/総事業費（検算済みの列のみ）・担当課自己評価と町の最終方針の評価結果。改善計画書・建議・要領・方針・読み方の資料、指標表、1次/2次評価は対象外。' },
};
