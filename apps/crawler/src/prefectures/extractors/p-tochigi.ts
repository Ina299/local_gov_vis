import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 栃木県（令和6(2024)年度 重点戦略マネジメントの結果（令和7(2025)年度の取組））
// 各プロジェクトの「令和７（2025）年度の取組」に「・事業名」と「N千円」が並ぶ。事業名の行の直後（空行のみを挟む）の行が金額の場合だけ、
// その事業の予算額として収録する。名前が2つ続いてから金額が2つ続く箇所や、ページ末尾に離れて出力された金額は対応を確定できないため未収録。
const TITLE = '令和６（2024）年度重点戦略マネジメントの結果（令和７（2025）年度の取組）について';
const NOTE = '注：重点戦略マネジメントに関する部分を抜き出しているため、事業名や予算額が予算関係資料と一致しないことがあります。';

function extractTochigi(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const ti = t.indexOf(TITLE);
  if (input.municipalityCode !== '09000' || ti < 0 || !t.includes(NOTE)) return [];
  const out: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  // 見出し「○…プロジェクト」で区切ってプロジェクト名を記録（事業の分類に使う）
  const heads = [...t.matchAll(/(?<=\n)○([^\n]+プロジェクト)\n/g)];
  for (const m of t.matchAll(/(?<=\n)・([^\n]+?(?:費|補助金|事業))\n/g)) {
    const name = m[1];
    const start = m.index!;
    if (seen.has(name)) continue;
    seen.add(name);
    const p = project(input, `B${out.length + 1}`, name, null, m[0].trimEnd(), start);
    p.evidence.push(evidence(input, TITLE, ti));
    const head = heads.filter(h => h.index! < start).at(-1);
    const after = t.slice(start + m[0].length);
    const next = /^(?:[ \t]*\n)*([\d,]+)千円\n/.exec(after);
    // 「※令和６年度２月補正予算での対応事業」の※印が金額の前後に単独行で出力される事業は、※がどちらの事業に付くか確定しないため未収録
    const starred = next && (/^\s*※\s*\n/.test(after.slice(next[0].length)) || /※\s*$/.test(t.slice(Math.max(0, start - 10), start)));
    if (starred) p.warnings.push('金額の前後に「※令和６年度２月補正予算での対応事業」の※印が単独行で出力されており、※の付く事業と年度（令和6年度補正か令和7年度か）を確定できないため金額は未収録。');
    else if (next) {
      const off = start + m[0].length + next[0].indexOf(next[1]);
      p.amounts.push(amount(input, 'budget', 2025, next[1], '千円', `${next[1]}千円`, off));
      p.evidence.push(evidence(input, NOTE, t.indexOf(NOTE)));
      p.warnings.push('金額は「令和７（2025）年度の取組」欄の事業名の直後に印字された千円額（予算額。資料末尾の注記「事業名や予算額が予算関係資料と一致しないことがあります」のとおり、重点戦略マネジメントに関する部分のみの額の場合がある）。資料公表（令和7年2月）時点の額で、決算額ではない。');
    } else p.warnings.push('事業名の直後に金額が続かず（事業名・金額がそれぞれ連続して出力される箇所、またはページ末尾に離れて出力された金額）、対応を確定できないため金額は未収録。');
    if (head) p.warnings.push(`掲載箇所: ${head[1]}`);
    p.warnings.push('栃木県重点戦略「とちぎ未来創造プラン」の重点戦略マネジメントで令和7年度に取り組む事業として列挙された事業のみ。担当部局は印字されていない。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '09000': {
    extract: (input) => extractTochigi(input),
    scope: '令和６（2024）年度 重点戦略マネジメントの結果（令和７（2025）年度の取組）に列挙された事業名と、事業名の直後に印字された予算額（千円、令和7年度）。担当部局は印字なし。プロジェクト評価シート・取組評価シート（主な事業の予算額が2段組みで事業名と対応しない）・現状評価は対象外。決算額は掲載資料になし。',
  },
};
