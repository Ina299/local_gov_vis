import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 仙北市（令和8年度 事務事業評価シート（様式１））
// 公開済みレコード（batch9/i4-semboku.ts）は同じシートの事業名・事業費総額から作られ、文章の欄は未収録だった。
// 「１.事務事業の目的、手段」は、目的・手段の本文の行頭（または行の間）に欄見出しの断片
// （目的／(何のために・／どのような成／果を期待する／か) と 手段／（活動内容））が割り込んだ形で抽出される。
// 目的: 欄の先頭から最初の空行までの段落で、目的の見出し断片5つがそれぞれちょうど1回ずつあり、手段の見出しを含まないもの。
// 事業内容: 目的が採れた票に限り、その空行の後から「２．投入されたコストの確認」までで、手段の見出し断片2つがそれぞれちょうど1回ずつあるもの。
// いずれも見出し断片を除き、欄の幅いっぱい（34字以上）で句点で終わらない行の後の改行（折り返し）を除く。箇条の記号で始まる行の前の改行は残す。
const HEAD = /No\.(\d+)\n【様式１】\n\n令和 ?(\d+)\n\n年度\n\n事務事業評価シート\n\n/g;
const DATE = '令和 \\d+ 年 \\d+ 月 \\d+ 日';
// 事業名の欄の位置（公開済みレコードの抽出と同じ4通り）。
const NAME = [
  /^事務事業名\n\n([^\n]+)\n\n(?:予算款項目|担当部課)\n/,
  /^事務事業名\n予算款項目\n\n([^\n]+)\n(?:\d+\n\n)?一般 /,
  new RegExp(`^事務事業名\\n予算款項目\\n\\n${DATE}\\n\\n([^\\n]+)\\n\\n担当部課\\n`),
  new RegExp(`^${DATE}\\n\\n事務事業名\\n\\n([^\\n]+)\\n\\n(?:担当部課|予算款項目)\\n`),
];
const OPEN = '１.事務事業の目的、手段\n', CLOSE = '２．投入されたコストの確認';
const PURPOSE_LABELS = ['目的', '(何のために・', 'どのような成', '果を期待する', 'か)'], MEANS_LABELS = ['手段', '（活動内容）'];
const MARK = /^(・|･|※|＊|\*|〇|○|◎|●|■|□|【|〔|\[|<|＜|[①-⑳]|（[０-９\d]+）|\([0-9]+\)|[０-９\d]+[.．)）、])/;

/** 見出し断片をそれぞれちょうど1回ずつ（行全体、または行頭＋空白）含む場合だけ、断片を除いて折り返しをつなぐ。 */
function clean(raw: string, labels: string[], others: string[]): string | null {
  const lines = raw.split('\n');
  const at = (l: string, x: string) => l === x || l.startsWith(x + ' ');
  if (labels.some(x => lines.filter(l => at(l, x)).length !== 1) || lines.some(l => others.some(x => at(l, x)))) return null;
  const body = lines.map(l => { const x = labels.find(y => at(l, y)); return x ? l.slice(x.length).trim() : l.trim(); }).filter(l => l);
  // 表の別の列（括弧書きの回数・数値だけの行）が混ざる欄は採らない。
  if (!body.length || body.some(l => labels.includes(l) || /^[（(][^）)]{1,8}[）)]$|^[\d０-９,，.．]+[^\s]{0,3}$/.test(l))) return null;
  const value = body.reduce((acc, l, i) => acc + (i === 0 ? '' : /[。．]$/.test(body[i - 1]) || body[i - 1].length < 34 || MARK.test(l) ? '\n' : '') + l, '');
  return value.length >= 10 ? value : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05215' || input.sourceId !== '633888305a917977d004b39a') return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, body = start + h[0].length, end = heads[k + 1]?.index ?? text.length;
    const seg = text.slice(body, end), nm = NAME.map(r => r.exec(seg)).find(Boolean);
    if (!nm || /令和|^一般|^[\d\s,-]+$/.test(nm[1])) return;
    const o = seg.indexOf(OPEN), c = seg.indexOf(CLOSE, o);
    if (o < 0 || c < 0) return;
    const block = seg.slice(o + OPEN.length, c), blank = block.indexOf('\n\n');
    if (blank < 0) return;
    const pRaw = block.slice(0, blank), mRaw = block.slice(blank).replace(/^\n+/, '').trimEnd();
    const purpose = clean(pRaw, PURPOSE_LABELS, MEANS_LABELS);
    const means = purpose && mRaw ? clean(mRaw.replace(/\n{2,}/g, '\n'), MEANS_LABELS, PURPOSE_LABELS) : null;
    if (!purpose) return;
    const p = project(input, `No.${h[1]}|narrative`, nm[1], 2018 + Number(h[2]), h[0] + nm[0], start);
    p.projectCode = `No.${h[1]}`;
    const at = body + o + OPEN.length;
    if (purpose) { p.purpose = purpose; p.evidence.push(evidence(input, pRaw, at)); }
    if (means) { p.activities = means; p.evidence.push(evidence(input, mRaw, at + block.indexOf(mRaw, blank))); }
    p.warnings.push('仙北市 令和8年度事務事業評価シート（様式１）の「１.事務事業の目的、手段」のうち、目的の段落を目的に、手段（活動内容）を事業内容に収録。'
      + '本文に割り込んだ欄見出しの断片と折り返しの改行は除去。見出し断片の数が合わない票は収録しない。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '仙北市 令和8年度 事務事業評価シート（様式１）: 「１.事務事業の目的、手段」の目的・手段（活動内容）の文章（欄見出しの断片の数が合うものだけ）。',
};
