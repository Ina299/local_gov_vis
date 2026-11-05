/**
 * 11369 東秩父村: 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証（令和5・6年度）。
 * 「事業の概要〈計画策定時〉」の「①目的・効果」の本文（「①」の後から「②」の行の前まで）を目的として収録する。
 * 抽出テキストでは表の上部に事業名の列が番号順に並び、その後に事業ごとの所管課と概要（①〜④）が同じ順に並ぶ。
 * 事業名の段落の数と①の数が一致する場合に限り、順番で対応させる。①の本文の行頭に入った補助・単独の列の語は除く。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Piece } from './m26-util';

const HEAD = /^令和([５６])年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11369' || !/\/uploaded\/life\/9461_5586[01]_misc\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, head = HEAD.exec(t);
  if (!head) return [];
  const year = 2018 + Number(String.fromCharCode(head[1].charCodeAt(0) - 0xfee0));
  // 事業名の列: 「の名称」の後から「所管課」の縦書き見出しの前まで。空行区切りの段落から番号だけの行・行頭の番号を除く。
  const a = t.indexOf('交付対象事業\nの名称\n\n'), b = t.indexOf('\n\n所\n管\n課\n', a);
  if (a < 0 || b < 0) return [];
  const names: { value: string; raw: string; at: number }[] = [];
  let at = a + '交付対象事業\nの名称\n\n'.length;
  for (const para of t.slice(at, b).split('\n\n')) {
    const lines = para.split('\n').filter(l => !/^\d+$/.test(l)).map(l => l.replace(/^\d+ /, ''));
    if (lines.length) names.push({ value: lines.join(''), raw: para, at });
    at += para.length + 2;
  }
  const blocks = [...t.matchAll(/\n\n①((?:[^\n]+\n)+?)(?:(?:単独|補助) )?②/g)].filter(m => m.index! > b);
  if (blocks.length !== names.length) return [];
  const out: ProjectEvaluation[] = [];
  blocks.forEach((m, i) => {
    // 補助・単独の列の語が行頭に入った行は、その語を除いた残りを本文の片とする。
    const pieces: Piece[] = [];
    let p = m.index! + 3;
    for (const l of m[1].slice(0, -1).split('\n')) {
      const col = /^(?:単独|補助)(?: |$)/.exec(l)?.[0] ?? '';
      if (l.length > col.length) pieces.push({ raw: l.slice(col.length), at: p + col.length });
      p += l.length + 1;
    }
    out.push(sheetRecord(input, `${year}:${i}`, names[i], { evaluationYear: null, evaluatedFiscalYear: year }, null,
      [{ key: 'purpose', pieces, value: joinWrapped(pieces.map(x => x.raw)) }],
      `東秩父村 令和${head[1]}年度 臨時交付金の実施状況及び効果検証の「①目的・効果」の本文を収録（PDFの折り返しの改行を除いた）。表の事業名の列と概要の列は番号順で対応させた。`));
  });
  return out;
}

export const entry = {
  extract,
  scope: '東秩父村 令和5・6年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証の「①目的・効果」。事業名と概要の数が一致する場合だけ順番で対応。',
};
