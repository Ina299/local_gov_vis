import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 愛媛県（事後評価シート【事務事業シート】、細施策ごとの政策的経費一覧・経常的経費一覧 PDF）
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const LABELS = new Set(['終期', '始期', '決算額', '予算額', '概', '要', '事', '業', '項', '当初']);
// 最終現計予算額・決算額のセル（R5〜R8 の4列）が「最終現計」に続けて4つ連続して出力される配置。
const CELL = String.raw`最終現計\n+(?:(${N}) 千円|千円)\n(?:(${N}) 千円|千円)`;
const RUN = new RegExp([CELL, CELL, CELL, CELL].join(String.raw`\n+`), 'g');

function extractEhime(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38000' || input.format !== 'pdf') return [];
  const t = input.text;
  const hd = /^令和([５６])年度\n\n事後評価シート\n\n【事務事業シート/.exec(t);
  if (!hd) return [];
  const fy = 2018 + Number(hd[1].normalize('NFKC'));
  const sheets = (t.match(/予算主管課/g) ?? []).length;
  const out: ProjectEvaluation[] = [];
  // 事業名（事項）: 「予算主管課 ○○課」の行の直前の行が事業名である配置のみ（シートが重なって出力され別の欄名が挟まる場合は対象外）。
  for (const m of t.matchAll(/(?<=\n\n)([^\n]+)\n\n?予算主管課 ([^\n]+)\n/g)) {
    const name = m[1].trim(), dept = m[2].trim();
    if (LABELS.has(name) || /^[\d.]+$/.test(name) || !/課$/.test(dept)) continue;
    const p = project(input, nfkc(name), name, null, m[0].trimEnd(), m.index);
    p.department = dept;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, hd[0].split('\n')[0], 0));
    const runs = [...t.matchAll(RUN)];
    if (sheets === 1 && runs.length === 1) {
      // 1シートだけの資料: 4列（令和5〜8年度）の並びが確定するので、決算額・最終現計予算額を列の年度で収録。
      const r = runs[0];
      const cols = [2023, 2024, 2025, 2026];
      for (let c = 0; c < 4; c++) {
        const [budget, actual] = [r[1 + c * 2], r[2 + c * 2]];
        if (!budget || !actual) continue;
        const cell = new RegExp(String.raw`最終現計\n+${budget} 千円\n${actual} 千円`).exec(t.slice(r.index!));
        if (!cell) continue;
        const off = r.index! + cell.index;
        p.amounts.push(amount(input, 'budget', cols[c], budget, '千円', cell[0], off), amount(input, 'actual', cols[c], actual, '千円', cell[0], off));
      }
      p.warnings.push('金額はコスト欄の最終現計予算額（予算として収録）と決算額。令和5〜8年度の4列が抽出テキストで連続して出力されている1シートだけの資料のため、列の年度を確定して収録。');
    } else p.warnings.push('同じ資料に複数のシートがあり、コスト欄（最終現計予算額・決算額）の各列がどの事業のどの年度か抽出テキストで確定しないため金額は未収録。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '38000': {
    extract: (input) => mergeReprints(extractEhime(input), p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`),
    scope: '事後評価（細施策・事務事業）の事務事業シート PDF（取得できた分のみ）の事業名（事項）・予算主管課・評価対象年度。金額は1シートだけの資料で列の年度が確定するもののみ（最終現計予算額・決算額）。シートが重なって出力され事業名と欄の対応が確定しないシート、令和5年度様式（事項が欄名と同じ行に出力される様式）、細施策シート、KPI は対象外。',
  },
};
