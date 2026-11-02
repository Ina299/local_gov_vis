import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 燕市（令和６年度 教育行政評価報告書、点検項目の票）
// 公開済みレコードは同じ報告書（2024_houkoku.pdf、対象年度＝令和６年度）。点検項目の票（6事業）は欄の見出しが各段落の
// 1行目の行頭にあるため、「取組の概要」欄を事業内容、「目標の達成状況」欄を成果として取る。欄の終わりにあるページ番号・
// 柱（「令和６年度 教育行政評価報告書」）の行は除き、欄の途中にそれらが入る版は採らない。「６年度達成目標」は年度の目標で
// 目的欄ではないため取らない。主要事業の一覧表（事業の概要）は事業名の列が本文の途中の行に入り、行の区切りが決まらないため対象外。
const HEAD = /^令和６年度 教育行政評価報告書\n点検項目 ([^\n]+)\n/gm;
const LABELS = ['６年度達成目標', '目標の達成状況', '取組の概要', '自己評価', '評価委員の評価', '今後の方向性'];

/** 見出し label の欄（見出しの後の本文から次の見出しの行の手前まで）。末尾のページ番号・柱の行は除く。 */
function field(seg: string, label: string, next: string): { value: string; raw: string; at: number } | null {
  const a = seg.indexOf(`\n${label} `), b = seg.indexOf(`\n${next} `, a + 1);
  if (a < 0 || b < 0 || seg.indexOf(`\n${label} `, a + 1) >= 0) return null;
  const at = a + label.length + 2;
  const lines = seg.slice(at, b).split('\n');
  while (lines.length && /^(\d+|令和６年度 教育行政評価報告書|)$/.test(lines[lines.length - 1].trim())) lines.pop();
  if (!lines.length || lines.some(l => /^(\d+|令和６年度 教育行政評価報告書|)$/.test(l.trim()) || LABELS.some(x => l.startsWith(`${x} `)))) return null;
  // 欄の幅での折り返しの改行だけを除く（欄の幅に満たない行の後と、箇条の記号で始まる行の前の改行は残す）。
  // 1行目は見出しと同じ行にあるため、見出しを付けたまま幅を測ってから見出しを外す。
  const value = unwrap(`${label} ${lines.map(l => l.trim()).join('\n')}`).slice(label.length + 1);
  return { value, raw: lines.join('\n'), at };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '15213' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/2024_houkoku.pdf')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = h[1].trim();
    const act = field(seg, '取組の概要', '自己評価'), res = field(seg, '目標の達成状況', '取組の概要');
    if (!act && !res) continue;
    const p = project(input, `narrative:${name}`, name, null, h[0].trimEnd(), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    if (act) { p.activities = act.value; p.evidence.push(evidence(input, act.raw, start + act.at)); }
    if (res) { p.outcomes = res.value; p.evidence.push(evidence(input, res.raw, start + res.at)); }
    p.warnings.push('燕市 令和６年度教育行政評価報告書の点検項目の票から、「取組の概要」欄を事業内容、「目標の達成状況」欄を成果として収録。'
      + '目的欄はない。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '燕市 令和６年度 教育行政評価報告書（2024_houkoku.pdf）の点検項目の票: 「取組の概要」（事業内容）・「目標の達成状況」（成果）。主要事業の一覧表は列が混ざるため対象外。',
};
