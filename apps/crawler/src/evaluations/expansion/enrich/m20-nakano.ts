import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 中野区（令和７年度 行政評価「令和6年度事業の行政評価」の票）
// 公開済みレコードは同じ冊子（sesakunoseika.pdf）の内部評価対象事業（対象年度＝令和６年度）。票の「目的\n(効果)」欄を目的、
// 「実施内容\n(6年度)」欄を事業内容として取る。目的欄の本文には隣の欄の見出し（「事業の」「始期-終期」）の行だけが割り込むことが
// あり、その行は除く（始期・終期の年度など見出し以外の行が割り込む版は採らない）。目的が①②などに分かれ、
// 「目的:」「効果:」が並ぶ票（本文と見出しが交互に出力される版）は対象外。実施内容は見出しの次の段落で、
// 空行の後に「事業のコストと人員」が続く版だけ。
// 票の区切りは柱「令和6年度事業の行政評価」の行（事業名の行が続かない票もあり、その票は対象外）。
const HEAD = /\n令和6年度事業の行政評価\n(?:事業名 ([^\n]+)\n)?/g;
const PURPOSE = /\n目的\n\(効果\)\n\n((?:(?!実施内容\n|事業名 )[^\n]*\n)+?)実施内容\n\(6年度\)\n\n((?:[^\n]+\n)+)\n事業のコストと人員\n/;
const LABEL = /^(事業の|始期-終期)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13114' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/sesakunoseika.pdf')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (!h[1]) continue;
    const m = PURPOSE.exec(seg);
    if (!m) continue;
    const name = h[1].trim();
    const p = project(input, `narrative:${name}`, name, null, h[0].slice(1, -1), start + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    const raw = m[1].replace(/\n+$/, ''), lines = raw.split('\n').map(l => l.trim()).filter(l => l && !LABEL.test(l));
    if (lines.length && !lines.some(l => /^(目的|効果|開始|終了予定)|年度$|^[①-⑳]/.test(l))) {
      // 欄の幅での折り返しの改行を除く（句点で終わる行の後だけ改行を残す）。
      p.purpose = lines.reduce((acc, l, j) => acc + (j === 0 ? '' : lines[j - 1].endsWith('。') ? '\n' : '') + l, '');
      p.evidence.push(evidence(input, raw, start + m.index + '\n目的\n(効果)\n\n'.length));
    }
    const act = m[2].trimEnd();
    if (!/^(目的|効果)[:：]/m.test(act)) {
      p.activities = act.split('\n').map(l => l.trim()).join('\n');
      p.evidence.push(evidence(input, act, start + m.index + m[0].indexOf('実施内容\n(6年度)\n\n') + '実施内容\n(6年度)\n\n'.length));
    }
    if (!p.purpose && !p.activities) continue;
    p.warnings.push('中野区 令和6年度事業の行政評価の票から、「目的(効果)」欄を目的、「実施内容(6年度)」欄を事業内容として収録。'
      + '目的欄に割り込んだ隣の欄の見出しの行（「事業の」「始期-終期」）は除き、欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '中野区 令和７年度行政評価「令和6年度事業の行政評価」（sesakunoseika.pdf）: 「目的(効果)」（目的）・「実施内容(6年度)」（事業内容）欄。本文と見出しが交互に出力される票は対象外。',
};
