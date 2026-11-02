import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m14-util';

// ---------------------------------------------------------------- 川越町（第２期まち・ひと・しごと創生総合戦略 効果検証シート 令和６年度事業評価）
// 公開済みレコードは同じ効果検証シート（128.pdf）の「主な事業」（評価年度の表記なし・対象年度2024）。事業ごとの「事業内容」欄と
// 「令和６年度の取組概要と成果、残された課題」欄を事業内容・成果として収録する。目的の欄はない。
// 「事業内容」の見出しは「事業」「内容」の2行に分かれ、本文の行と次の3通りに並ぶ（いずれも本文は1段落の折り返し）:
//   事業\n本文…\n内容 ／ 事業 本文1\n内容 本文2 ／ 本文1\n事業\n本文2\n内容\n本文3
const HEAD = /^([①-⑳]) ([^\n]+)\n\n?所管課\n\n?([^\n]+)\n/gm;
const PROGRESS = /\n■(?:令和６|2024)年度の進展度（３月末時点）\n/;
const RESULT = /\n■(?:令和６|2024)年度の取組概要と成果、残された課題（３月末時点）\n/;
const NEXT = '\n■令和７年度以降の取り組み方向（３月末時点）\n';

/** 見出し「事業」「内容」を除いた本文の行。並びが3通りのどれにも当たらなければ null。 */
function bodyLines(lines: string[]): string[] | null {
  if (lines.length >= 3 && lines[0] === '事業' && lines[lines.length - 1] === '内容' && lines.slice(1, -1).every(l => l !== '事業' && l !== '内容')) return lines.slice(1, -1);
  if (lines.length === 2 && lines[0].startsWith('事業 ') && lines[1].startsWith('内容 ')) return [lines[0].slice(3), lines[1].slice(3)];
  if (lines.length === 5 && lines[1] === '事業' && lines[3] === '内容' && ![lines[0], lines[2], lines[4]].some(l => /^(事業|内容)/.test(l))) return [lines[0], lines[2], lines[4]];
  return null;
}

/** 折り返しだけをつなぐ（句点で終わる行の後は段落の区切りとして改行を残す）。 */
const join = (ls: string[]) => ls.reduce((acc, l, i) => acc + (i && /。$/.test(ls[i - 1]) ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '24344' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/001/003/911/128.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.includes('効果検証シート（令和６年度事業評価）')) return [];
  const heads = [...t.matchAll(HEAD)];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], name = h[2].trim(), dept = h[3].trim();
    if (name.startsWith('主な事業の事業名')) continue; // 作成要領の見本
    const start = h.index!, end = heads[i + 1]?.index ?? t.length, seg = t.slice(start, end);
    const pg = PROGRESS.exec(seg);
    if (!pg) continue;
    // 所管課の行の後から進展度の見出しの手前まで（間に入る「令和6年度」の欄外表記と空行は除く）。
    let from = h[0].length;
    const sheetMark = /^\n令和6年度\n\n/.exec(seg.slice(from));
    if (sheetMark) from += sheetMark[0].length;
    while (seg[from] === '\n') from++;
    const raw = seg.slice(from, pg.index);
    if (!raw || raw.includes('\n\n')) continue;
    const body = bodyLines(raw.split('\n'));
    if (!body || body.some(l => !l.trim())) continue;
    const p = project(input, `narrative:${h[1]}:${name}`, name, null, h[0].trimEnd(), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2024; p.department = dept;
    p.activities = join(body.map(l => l.trim()));
    p.evidence.push(evidence(input, raw, start + from));
    const rs = RESULT.exec(seg), ne = rs ? seg.indexOf(NEXT, rs.index) : -1;
    if (rs && ne > rs.index) {
      const r = seg.slice(rs.index + rs[0].length, ne);
      // ページ番号・改ページ（空行）をまたぐ欄は範囲が確かでないため採らない。
      if (r.trim() && !r.includes('\n\n')) {
        p.outcomes = unwrap(r);
        p.evidence.push(evidence(input, r, start + rs.index + rs[0].length));
      }
    }
    p.warnings.push('川越町 第２期まち・ひと・しごと創生総合戦略 効果検証シート（令和６年度事業評価）の「事業内容」欄を事業内容として、'
      + '「令和６年度の取組概要と成果、残された課題」欄を成果として収録。見出しの「事業」「内容」の行を除き、欄の幅での折り返しをつないだ。目的の欄はない。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '川越町 第２期総合戦略 効果検証シート（令和６年度事業評価）の主な事業: 「事業内容」「令和６年度の取組概要と成果、残された課題」欄。目的欄はない。',
};
