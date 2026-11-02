import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 清川村（第４次総合計画 令和６年度実施計画）
// 公開済みレコードは令和６年度実施計画 実績評価（r6zissekihyouka.pdf、対象年度＝令和６年度）の実施計画事業。実績評価の
// 「事業の成果・課題」は事業名・番号の列と行の並びが逆順に出力され対応が決まらないため、同じ令和６年度実施計画の本体
// （r6jissikeikaku.pdf）の「内容」欄を事業内容として取る。事業名の行（番号＋事業名）の次の段落が内容で、その後に
// R6事業費・区分（新規・継続など）が続く版だけ。内容の段落に事業費の数値や事業名の行が割り込む版は採らない。目的欄はない。
const ROW = /\n(\d+) ([^\n]+)\n\n((?:[^\n]+\n)+)\n(?:[\d,]+ |[\d,]+\n\n)?(?:新規|継続|拡充|完了|廃止|休止)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14402' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/r6jissikeikaku.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.includes('\n令和６年度実施計画\n')) return [];
  for (const m of t.matchAll(ROW)) {
    if (input.truncated && m.index! + m[0].length >= t.length) continue;
    const name = m[2].trim(), lines = m[3].trimEnd().split('\n').map(l => l.trim());
    if (lines.some(l => /^[\d,]+$|^\d+ |■|課$/.test(l)) || !lines.join('').endsWith('。')) continue;
    const at = m.index! + 1;
    const p = project(input, `narrative:${name}`, name, null, `${m[1]} ${m[2]}`, at);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    // 欄の幅での折り返しの改行を除き、句点で終わる行の後だけ改行を残す。
    p.activities = lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');
    p.evidence.push(evidence(input, m[3].trimEnd(), at + m[1].length + 1 + m[2].length + 2));
    p.warnings.push('清川村 第４次総合計画 令和６年度実施計画の「内容」欄（令和６年度の実施計画事業）を、同年度の実績評価のレコードの事業内容として収録。'
      + '目的欄はない。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '清川村 第４次総合計画 令和６年度実施計画（r6jissikeikaku.pdf）: 実施計画事業の「内容」欄（事業内容）。内容の段落に事業費・事業名の行が割り込む版は対象外。',
};
