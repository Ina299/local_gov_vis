import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 田辺市（令和７年度 教育委員会の点検・評価報告書の事務事業評価シート）
// 公開済みレコードは同じ報告書（R7houkokusyo.pdf、令和６年度分の17事業）から作られ、成果はあるが目的がない。
// 「実施目的」欄は、欄の見出し「実 施 目 的」が欄の縦の中央に置かれ、抽出テキストでは見出しが欄の途中の行頭に
// 入るか、単独の行になる。欄の内容は事業名の行の直後から始まり、続く「事業の概要（内容・現状）」欄との区切りが
// テキストにないため、見出しの前後の行数が揃う（差1行以内）位置で句点で終わる行を欄の終わりとし、その位置が
// 1つに決まる場合だけ採る。内容・現状欄は欄の外の縦書きの文字（事・業・の・概・要）が行頭に混ざるため扱わない。
const SHEET = /令和６年度 田辺市教育委員会事務事業評価シート[ \n]【№([0-9０-９]+)】\n担当課名 ([^\n]+)\n/g;
const LABEL = '実 施 目 的';
/** 内容・現状欄の始まり（縦書きの欄名の文字・番号付きの箇条・欄名）。 */
const NEXT = /^(事|業|の|概|要)( |$)|^[①-⑳]|内容・現状/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30206' || !input.sourceUrl.endsWith('/R7houkokusyo.pdf')) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const from = h.index!, sheet = t.slice(from, heads[i + 1]?.index ?? t.length);
    const name = /\n事 業 名 ([^\n]+)\n/.exec(sheet);
    if (!name) return;
    const at = from + name.index! + name[0].length, lines = t.slice(at, from + sheet.length).split('\n');
    const li = lines.findIndex(l => l === LABEL || l.startsWith(`${LABEL} `));
    if (li < 0 || li > 8 || lines.slice(0, li).some(l => !l.trim() || NEXT.test(l))) return;
    const inline = lines[li].slice(LABEL.length).trim();
    // 欄の終わりの候補: 見出しの行（内容があるとき）または見出しより後の行で、句点で終わり、見出しの前後の行数の差が1以内。
    const ends: number[] = [];
    if (inline && /。$/.test(inline) && li <= 1) ends.push(li);
    for (let k = li + 1; k < lines.length && !NEXT.test(lines[k]) && lines[k].trim(); k++)
      if (/。$/.test(lines[k]) && Math.abs(li - (k - li)) <= 1) ends.push(k);
    if (ends.length !== 1) return;
    const parts = [...lines.slice(0, li), ...(inline ? [inline] : []), ...lines.slice(li + 1, ends[0] + 1)];
    const value = parts.reduce((acc, l, j) => acc + (j > 0 && /。$/.test(parts[j - 1]) ? '\n' : '') + l, '');
    const raw = lines.slice(0, ends[0] + 1).join('\n');
    const p = project(input, `No${h[1].normalize('NFKC')}:purpose`, name[1].trim(), 2025, sheet.slice(0, name.index! + name[0].length - 1), from);
    p.projectCode = `No${h[1].normalize('NFKC')}`;
    p.evaluatedFiscalYear = 2024;
    p.department = h[2].trim();
    p.purpose = value;
    p.evidence.push(evidence(input, raw, at));
    p.warnings.push('田辺市 教育委員会事務事業評価シート（令和６年度）の「実施目的」欄。欄の見出しを除き、欄の幅での折り返しは改行を除いてつないだ。'
      + '内容・現状欄との区切りは、見出しが欄の縦の中央にあることから前後の行数で判定（1つに決まる場合のみ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '田辺市 令和７年度 教育委員会点検・評価報告書（令和６年度 事務事業評価シート17事業）: 実施目的欄（内容・現状欄との区切りが1つに決まるもの）。',
};
