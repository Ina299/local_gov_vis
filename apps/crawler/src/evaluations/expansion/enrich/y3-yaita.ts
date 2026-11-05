import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 矢板市（地方創生臨時交付金【事業評価結果】令和２年度実施分 18382.pdf）
// 公開済みレコードはこの資料の各票から作られ、年度を持たない（m20-yaita.ts の令和３・５年度分とは別様式）。票に目的の欄はなく、
// 「事業の実施状況又は経過」欄を事業内容として取る。欄の本文が見出しの次の段落に空行なしで続き、その直後に「成果及び評価」が来る票だけ
// （日付と内容が別の列に分かれて空行を挟んで出力される票は対応が並び順でしか決まらないため採らない）。
// 「成果及び評価」は①成果・効果、②測定方法、③評価の見出しと本文が交互・まとめて出力され、本文の区切りが確定しないため取らない。
const HEAD = /\n所属名\n\n[^\n]+\n\n事業番号\n\n[^\n]+\n\n事業名\n\n([^\n]+)\n/g;
const BODY = /^\n\n事業の実施状況又は経過\n\n((?:[^\n]+\n)+)\n?成果及び評価\n/;
const FILE = 'https://www.city.yaita.tochigi.jp/uploaded/attachment/18382.pdf';

/** 全角2・半角1で数えた行の幅。 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[\u0000-ÿ｡-ﾟ]/.test(c) ? 1 : 2), 0);
/** 欄の幅（全角約26字）まで埋まった行の後の折り返しの改行だけ除く（句点で終わる行・短い行の後と、箇条・日付で始まる行の前は残す）。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => {
  const prev = lines[i - 1];
  return acc + (i === 0 ? '' : /。$/.test(prev ?? '') || width(prev) < 50 || /^(?:[・①-⑳]|R\d)/.test(l) ? '\n' : '') + l;
}, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09211' || input.format !== 'pdf' || input.sourceUrl !== FILE) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], all: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], end = h.index! + h[0].length - 1, seg = t.slice(end, heads[i + 1]?.index ?? t.length);
    const b = BODY.exec(seg);
    if (!b) continue;
    const name = h[1].trim();
    const p = project(input, `narrative:${name}`, name, null, h[0].slice(1, -1), h.index! + 1);
    p.projectCode = null;
    p.activities = join(b[1].trimEnd().split('\n').map(l => l.trim()));
    p.evidence.push(evidence(input, b[1].trimEnd(), end + '\n\n事業の実施状況又は経過\n\n'.length));
    p.warnings.push('矢板市 地方創生臨時交付金【事業評価結果】の「事業の実施状況又は経過」欄を事業内容として収録（目的欄はない）。'
      + '本文が空行なしで続く票のみ。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    all.push(p);
  }
  // 同じ資料に同名の票が複数あれば対応が決まらないため採らない
  return all.filter(p => heads.filter(h => h[1].trim() === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '矢板市 地方創生臨時交付金【事業評価結果】（18382.pdf）: 「事業の実施状況又は経過」欄（事業内容。本文が空行なしで続く票のみ）。目的欄はない。年度なしの公開済みレコードと同じPDFに限る。',
};
