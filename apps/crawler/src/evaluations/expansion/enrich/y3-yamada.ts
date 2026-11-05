import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 山田町（復興交付金事業計画の個別事業の実績に関する評価様式）
// 公開済みレコードは同じ様式（町実施分 02〜05_kobetuzigyouNN.pdf）の各票から作られ、年度を持たない。票の「事業目的・事業地区」欄を目的、
// 「事業結果」欄を事業内容として取る。事業結果は年度ごとの実施内容の箇条書きが多いが、表（整備内容・設置数など）が混じる票は
// 列が崩れて行の対応が決まらないため、空行や数値だけの行を含む欄は採らない。成果の欄（成果・効果）はない
// （「事業結果の活用状況に関する調査・分析・評価」は評価の文章のため取らない）。
const HEAD = '【復興交付金事業計画の個別事業の実績に関する評価様式】';
const ID = /^【[^】]+】\n事業番号\n+([^\n]+)\n+事 ?業 ?名\n+([^\n]+)\n/;
const FIELDS = /\n事業目的・事業地区\n((?:[^\n]+\n)+?)事業結果\n((?:[^\n]*\n)+?)事業の実績に関する評価\n/;
const FILES = /^https:\/\/www\.town\.yamada\.iwate\.jp\/fs\/1\/1\/2\/1\/0\/\d\/_\/0[2-5]_kobetuzigyou0[1-4]\.pdf$/;

/** 欄の幅（約45字）での折り返しの改行を除く。句点で終わる行・短い行の後の改行は残す。 */
const join = (raw: string) => {
  const lines = raw.trimEnd().split('\n').map(l => l.trim());
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : /。$/.test(lines[i - 1]) || lines[i - 1].length < 40 ? '\n' : '') + l, '');
};

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03482' || input.format !== 'pdf' || !FILES.test(input.sourceUrl)) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index!);
  const all: ProjectEvaluation[] = [];
  for (const [i, s] of starts.entries()) {
    if (input.truncated && i === starts.length - 1) continue;
    const sh = t.slice(s, starts[i + 1] ?? t.length);
    const id = ID.exec(sh), f = FIELDS.exec(sh);
    if (!id || !f || sh.indexOf('\n事業目的・事業地区\n', f.index + 1) >= 0) continue;
    const name = id[2].trim();
    const p = project(input, `narrative:${id[1].trim()}`, name, null, id[0].trim(), s);
    p.projectCode = id[1].trim();
    const purposeAt = s + f.index + '\n事業目的・事業地区\n'.length;
    p.purpose = join(f[1]);
    p.evidence.push(evidence(input, f[1].trimEnd(), purposeAt));
    // 表が混じる事業結果（空行・数値や記号だけの行・ごく短い行）は採らない
    const result = f[2].trimEnd();
    if (!result.includes('\n\n') && !result.split('\n').some(l => l.trim().length <= 3 || /^[\d０-９,，.\s－―\-局台基戸件棟㎡ｍ％%]+$/.test(l.trim()))) {
      p.activities = join(result);
      p.evidence.push(evidence(input, result, purposeAt + f[1].length + '事業結果\n'.length));
    }
    p.warnings.push('山田町 復興交付金事業計画の個別事業の実績に関する評価様式の「事業目的・事業地区」欄を目的、「事業結果」欄を事業内容として収録'
      + '（事業結果は表が混じらない票のみ）。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    all.push(p);
  }
  // 同じ資料に同名の票が複数あれば対応が決まらないため採らない
  return all.filter(p => all.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '山田町 復興交付金事業計画の個別事業の実績に関する評価様式（町実施分）: 「事業目的・事業地区」欄（目的）と「事業結果」欄（事業内容。表が混じらない票のみ）。年度なしの公開済みレコードと同じPDFの票に限る。',
};
