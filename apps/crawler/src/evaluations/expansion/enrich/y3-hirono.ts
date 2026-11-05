import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 洋野町（復興交付金事業計画の個別事業の実績に関する評価様式・町実施分）
// 公開済みレコードは同じ様式（岩手県サイト掲載の 02_hirono_kobetu_machi.pdf）の各票の事業番号・事業名から作られ、年度を持たない。
// 票の「事業目的・事業地区」欄を目的として取る。「事業結果」欄は施設概要の表と写真の説明が混じって行の対応が決まらないため取らない。
// 成果の欄はない（「事業結果の活用状況に関する調査・分析・評価」は評価の文章）。
const HEAD = '【復興交付金事業計画の個別事業の実績に関する評価様式】\n';
const ID = /\n事業番号 (\S+)\n事 業 名 ([^\n]+)\n/y;
const PURPOSE = /\n事業目的・事業地区[^\n]*\n((?:[^\n]+\n)+?)事業結果\n/;
const FILE = 'https://www.pref.iwate.jp/_res/projects/default_project/_page_/001/048/785/02_hirono_kobetu_machi.pdf';

/** 全角2・半角1で数えた行の幅。 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[\u0000-ÿ｡-ﾟ]/.test(c) ? 1 : 2), 0);
/** 欄の幅（全角約39字）まで埋まった行の後の折り返しの改行だけ除く（句点で終わる行・短い行の後の改行は残す）。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) =>
  acc + (i === 0 ? '' : /。$/.test(lines[i - 1]) || width(lines[i - 1]) < 70 ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03507' || input.format !== 'pdf' || input.sourceUrl !== FILE) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index!);
  const all: ProjectEvaluation[] = [], names: string[] = [];
  for (const [i, s] of starts.entries()) {
    if (input.truncated && i === starts.length - 1) continue;
    ID.lastIndex = s + HEAD.length - 1;
    const id = ID.exec(t);
    if (!id) continue;
    const name = id[2].trim();
    names.push(name);
    const sh = t.slice(s, starts[i + 1] ?? t.length), f = PURPOSE.exec(sh);
    if (!f || sh.indexOf('\n事業目的・事業地区', f.index + 1) >= 0) continue;
    const p = project(input, `narrative:${id[1]}`, name, null, id[0].slice(1, -1), id.index + 1);
    p.projectCode = id[1];
    p.purpose = join(f[1].trimEnd().split('\n').map(l => l.trim()));
    p.evidence.push(evidence(input, f[1].trimEnd(), s + f.index + f[0].indexOf('\n', 1) + 1));
    p.warnings.push('洋野町 復興交付金事業計画の個別事業の実績に関する評価様式の「事業目的・事業地区」欄を目的として収録。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    all.push(p);
  }
  // 同じ資料に同名の票が複数あれば（効果促進事業など）対応が決まらないため採らない
  return all.filter(p => names.filter(n => n === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '洋野町 復興交付金事業計画の個別事業の実績に関する評価様式（町実施分）: 「事業目的・事業地区」欄（目的）。同名の票が複数ある事業は除く。年度なしの公開済みレコードと同じPDFに限る。',
};
