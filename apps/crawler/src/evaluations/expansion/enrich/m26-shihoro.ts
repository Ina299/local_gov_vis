/**
 * 01632 士幌町: 令和２年度 新型コロナウイルス感染症対応地方創生臨時交付金 事業実施状況と効果検証。
 * 「事業の概要」の「①目的・効果」の本文（「① 」の後から「② 」の行の前まで）を目的として収録する。
 * 抽出テキストではページごとに事業名の列が番号順に並び、その後に事業ごとの概要（①〜④）が同じ順に並ぶ。
 * ページ内の事業名の段落の数と①の数が一致する場合に限り、順番で対応させる。①の本文の間に入った事業始期・終期の行（「R2.4」「～」）は除く。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Piece } from './m26-util';

const PAGE = '令和２年度\n\nNo.\n\n新型コロナウイルス感染症対応地方創生臨時交付金\n\n事業名\n\n';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01632' || !/\/content_20220311_084022\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (let a = t.indexOf(PAGE); a >= 0; a = t.indexOf(PAGE, a + 1)) {
    const b = t.indexOf('\n\n事業実施状況と効果検証\n', a), c = t.indexOf('\n総事業費\n', b), next = t.indexOf(PAGE, a + 1);
    if (b < 0 || c < 0 || (next >= 0 && c > next)) continue;
    const names: { value: string; raw: string; at: number }[] = [];
    let at = a + PAGE.length;
    for (const para of t.slice(at, b).split('\n\n')) {
      const lines = para.split('\n').filter(l => !/^\d+$/.test(l)).map(l => l.replace(/^\d+ /, ''));
      if (lines.length) names.push({ value: lines.join(''), raw: para, at });
      at += para.length + 2;
    }
    const blocks: Piece[][] = [];
    let cur: Piece[] | null = null, p = b;
    for (const l of t.slice(b, c).split('\n')) {
      if (/^① /.test(l)) blocks.push(cur = [{ raw: l.slice(2), at: p + 2 }]);
      else if (/^[②③④] /.test(l)) cur = null;
      else if (cur && !/^(R\d+\.\d+|～)$/.test(l)) cur.push({ raw: l, at: p });
      p += l.length + 1;
    }
    if (blocks.length !== names.length) continue;
    blocks.forEach((pieces, i) => out.push(sheetRecord(input, `${names[i].at}`, names[i], { evaluationYear: null, evaluatedFiscalYear: 2020 }, null,
      [{ key: 'purpose', pieces, value: joinWrapped(pieces.map(x => x.raw)) }],
      '士幌町 令和２年度 臨時交付金の事業実施状況と効果検証の「①目的・効果」の本文を収録（PDFの折り返しの改行を除いた）。ページ内の事業名の列と概要の列は番号順で対応させた。')));
  }
  return out;
}

export const entry = {
  extract,
  scope: '士幌町 令和２年度 新型コロナウイルス感染症対応地方創生臨時交付金 事業実施状況と効果検証の「①目的・効果」。ページ内の事業名と概要の数が一致する場合だけ順番で対応。',
};
