/**
 * 13205 青梅市: 令和7年度 行政評価シート（令和6年度実施事務事業）。「２．事業の目的」は「対象（誰を・何を）」と「目的（どういう状態にしたいのか）」の
 * 2列で、抽出テキストでは列の間が空白1つになる。目的だけを採る。
 * - 1行のとき: 空白がちょうど1つの行に限り、空白の後を目的とする。
 * - 3行のとき（1行目が目的の列の幅いっぱい、または1・3行目がともに箇条）: 対象の列は中央の行に入る（中央の行に空白が1つあれば空白の後は目的の続き）。1・3行目と中央の行の目的部分をつなぐ。
 * それ以外の行数・空白の数は列の区切りが確定しないため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Piece } from './m26-util';

const HEAD = /令和 7 年度評価シート （令和 6 年度実施事務事業） 整理番号 [^\n]+\n部名 [^\n]+ 課名 ([^\n]+)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13205' || !/\/uploaded\/attachment\/79021\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事務事業名 (\d+) ([^\n]+?) 事業類型 [^\n]+\n/.exec(seg);
    const block = /\n２．事業の目的\n対象（誰を・何を） 目的（どういう状態にしたいのか）\n((?:[^\n]+\n)+?)３．事業の指標と単位当たりコスト /.exec(seg);
    if (!name || !block) continue;
    let at = start + block.index! + block[0].indexOf('）\n', block[0].indexOf('目的（')) + 2;
    const lines = block[1].slice(0, -1).split('\n'), offs: number[] = [];
    for (const l of lines) { offs.push(at); at += l.length + 1; }
    const right = (k: number): Piece | null => {
      const parts = lines[k].split(' ');
      return parts.length === 2 && parts[0] && parts[1] ? { raw: parts[1], at: offs[k] + parts[0].length + 1 } : null;
    };
    let pieces: Piece[] | null = null;
    if (lines.length === 1) { const r = right(0); pieces = r && [r]; }
    else if (lines.length === 3 && !lines[0].includes(' ') && !lines[2].includes(' ')) {
      const mid = lines[1].includes(' ') ? right(1) : null;
      // 1行目が列の幅いっぱい（折り返し）か、1・3行目がともに箇条で、中央の行が対象（空白があればその前）であること。
      const wrapped = lines[0].length >= 40, bullets = /^・/.test(lines[0]) && /^・/.test(lines[2]);
      if (mid ? wrapped : (wrapped || bullets) && lines[1].length < lines[0].length)
        pieces = [{ raw: lines[0], at: offs[0] }, ...(mid ? [mid] : []), { raw: lines[2], at: offs[2] }];
    }
    if (!pieces) continue;
    out.push(sheetRecord(input, `${start}`, { value: name[1] + name[2], raw: name[0].slice(1, -1), at: start + name.index! + 1 },
      { evaluationYear: 2025, evaluatedFiscalYear: 2024 }, heads[i][1].trim(),
      [{ key: 'purpose', pieces, value: joinWrapped(pieces.map(p => p.raw)) }],
      '青梅市 令和7年度行政評価シートの「２．事業の目的」のうち「目的（どういう状態にしたいのか）」の列を収録（対象の列と列の間の空白で分け、PDFの折り返しの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '青梅市 令和7年度 行政評価シート（令和6年度実施事務事業）の「事業の目的」の目的の列。対象の列との区切りが確定する場合だけ。',
};
