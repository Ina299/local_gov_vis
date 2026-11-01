import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 宇治市（歳入歳出決算にかかる主要な施策の成果説明書）
// 公開済みレコードは同じ成果説明書の事業カード（所管課・決算額・事務事業名）から作られ、文章の欄は未収録だった。
// カードの欄は「事務事業名／事業内容／成果・実績／事業評価」で、目的の欄はない（令和5年度版のPDFで確認）。抽出テキストでは
// 見出し（所管課・決算額）の直後に事業内容の本文、「事務事業名 …」「事業内容」の行、成果・実績の本文、「成果・実績」の行が並ぶ。
// 事業内容 → activities、成果・実績 → outcomes。どちらも空行を挟まない1段落で、数値だけの行（段組みで項目から離れた金額・表のセル）や
// 別の欄の見出しを含まない場合に限る。成果・実績は「成果・実績」の行の直後が「事業評価」の行であること（写真の説明や段組みの続きがない）。
const SOURCES = new Set(['275700db02d1c5e3f8c7c6d5', '28c0d50e5b48b40bf9eacf25', '3f9721f1e11db6e90de04055', '4f0f511f50e38acaeb779836',
  '571e65814bc9857bfbe9fcba', '5bcb6ba86491f7e235461874', '5d27ac439b3c9a494b8d4b73', '6e71a62262f94a7978af1452', '7fe926db4a363351cc4564f4',
  '91e74111cc14d6d8600fd6f9', 'a68686f13b17c7f89c360775', 'b1133e5a0dea8947d9f5e056', 'f6e1c5654e7d80d277907a9e']);
const DIGITS = '０１２３４５６７８９';
const TITLE = /^(令和|平成) ?([元\d０-９]+) ?年度\n歳 入 歳 出 決 算 に か か る\n主 ?要な施 ?策の成 ?果説明 ?書\n/;
const HEAD = /^所管課\n([^\n]+)\n決算額\n(?:[\d,]+ ?千円)\n/gm;
const NAME = /^事務事業名 ([^\n]+)\n\n?事業内容\n/gm;
const LABELS = /所管課|所管部局|決算額|事務事業名|事業内容|成果・実績|事業評価|総合計画の体系|決算成果説明書/;

const fiscalYear = (era: string, n: string) =>
  (era === '令和' ? 2018 : 1988) + (n === '元' ? 1 : Number([...n].map(c => (DIGITS.includes(c) ? DIGITS.indexOf(c) : c)).join('')));
/** 1段落の欄の本文か（空行・数値だけの行・他の欄の見出しを含まない）。 */
const paragraph = (s: string) => s.length > 0 && !s.includes('\n\n') && !LABELS.test(s) && !s.split('\n').some(l => /^[\d,.\s％%千円人件回]*$/.test(l));
/** 箇条の記号で始まる行（段組みで金額が別の列に離れた一覧）。 */
const LIST = /^[◎○●・■□◆◇]/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '26204' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const fy = fiscalYear(title[1], title[2]);
  const bounds = [...t.matchAll(/^所管課/gm)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const start = h.index!, next = bounds.find(b => b > start) ?? t.length;
    const dept = h[1].trim();
    if (dept === '各担当課' || /決算額|事務事業名|所管/.test(dept)) continue;
    const seg = t.slice(start, next), names = [...seg.matchAll(NAME)];
    if (names.length !== 1 || (seg.match(/^事務事業名/gm) ?? []).length !== 1) continue;
    const n = names[0], name = n[1].trim();
    if (!name || /^(事業内容|成果・実績|事業評価)$/.test(name)) continue;
    // 事業内容: 見出しの直後から「事務事業名」の行の前まで。
    const contentRaw = seg.slice(h[0].length, n.index!).replace(/\n+$/, '');
    // 成果・実績: 「事業内容」の行の後から、単独の「成果・実績」の行（直後が「事業評価」の行）の前まで。
    const after = seg.slice(n.index! + n[0].length), res = /^\n?([^]*?)\n成果・実績\n\n?事業評価\n/.exec(after);
    const resultRaw = res?.[1] ?? '';
    // 事業内容の最後の行が箇条の見出しなら成果・実績の欄の一部が混入しているため除く。成果・実績は箇条を含む欄を除く。
    const hasContent = paragraph(contentRaw) && !/(?:^|\n)[◎○●■□][^\n]*$/.test(contentRaw), hasResult = paragraph(resultRaw) && !LIST.test(resultRaw);
    if (!hasContent && !hasResult) continue;
    const nameAt = start + n.index!;
    const p = project(input, `${dept}|${name}|narrative`, name, null, n[0].replace(/\n\n?事業内容\n$/, ''), nameAt);
    p.projectCode = null;
    p.department = dept;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, h[0].trimEnd(), start), evidence(input, title[0].trimEnd(), title.index));
    if (hasContent) {
      p.activities = unwrap(contentRaw);
      p.evidence.push(evidence(input, contentRaw, start + h[0].length));
    }
    if (hasResult) {
      p.outcomes = unwrap(resultRaw);
      p.evidence.push(evidence(input, resultRaw, start + n.index! + n[0].length + res!.index! + res![0].indexOf(resultRaw)));
    }
    p.warnings.push(`宇治市 ${title[1]}${title[2]}年度 歳入歳出決算にかかる主要な施策の成果説明書の事業カードの「事業内容」を事業内容に、「成果・実績」を成果に収録（欄の幅で折り返した改行は除去）。`
      + 'カードに目的の欄はない。空行・数値だけの行を含む欄（段組みで金額や表が本文から離れたもの）や、成果・実績の後に写真の説明などが続く欄、箇条を含む成果・実績、最後の行が箇条の見出しの事業内容は収録しない。「事業評価」欄は未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '宇治市 歳入歳出決算にかかる主要な施策の成果説明書（平成22〜令和5年度決算のうち13冊）の事業カードの「事業内容」「成果・実績」の本文（1段落で数値の段組みを含まないものだけ）。カードに目的の欄はない。',
};
