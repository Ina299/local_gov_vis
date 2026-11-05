/**
 * 34369 北広島町: 令和６年度主要施策の概要（主要施策成果シート）。公開済みレコードは batch8/h2-misc の抽出で、
 * 「目的」見出しの直後に本文が続くシートだけ目的が収録済み。抽出テキストでは見出しと本文の間に決算データの数値・（円）の
 * セルが挟まるシートがあるため、「目的」見出しから「内容（箇条書き）」見出しまでの最後の段落（空行で区切られたまとまり）が
 * 文章（数値・欄の見出し語を含まず、句点などで終わる）で、その直前が数値・（円）などのセルか見出しそのものの場合だけ目的とする。
 * 「目的」の見出しがない（見出しが別の位置に出る）シートは採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { isNumLine, sheetRecord } from './m24-util';

const SOURCE = '5565c33146172695cb5c5757';
/** 目的の段落の直前に来てよいセル（数値・単位・年度・ページ・財源内訳の縦書きの字）。 */
const CELL = /^([\d,]+|（円）|[ＲR][０-９\d]+年度|Ｐ\. ?[\d,.\-]+|訳|対象年度|一般財源)$/;
const LABEL = /^(（円）|事業費.*|一般財源|事業成果|課題・問題点|内容（箇条書き）|事業概要|対象年度|予算科目|決算.*|担当.*)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34369' || input.sourceId !== SOURCE || !input.text.includes('令和６年度主要施策の概要')) return [];
  const t = input.text, heads = [...t.matchAll(/主要施策成果シート\n/g)], out: ProjectEvaluation[] = [], seen = new Set<string>();
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const nm = /\n事業名\n\n([^\n]+)\n/.exec(seg);
    if (!nm || !/\n対象年度\n\n/.test(seg) || !seg.includes('事業成果\n（目標達成状況）')) continue;
    const name = nm[1].trim();
    // 公開済みの抽出は同じ事業名のシートの最初の1枚だけを採っている。
    if (seen.has(name)) continue;
    seen.add(name);
    const a = seg.indexOf('\n目的\n'), b = a < 0 ? -1 : seg.indexOf('内容（箇条書き）', a);
    if (a < 0 || b < 0) continue;
    const region = seg.slice(a + 4, b).replace(/\n+$/, '');
    const cut = region.lastIndexOf('\n\n'), para = cut < 0 ? region : region.slice(cut + 2);
    const before = (cut < 0 ? '' : region.slice(0, cut)).trim().split('\n').pop()!.trim();
    const lines = para.split('\n');
    if (before && !CELL.test(before)) continue;
    if (lines.some(l => !l.trim() || isNumLine(l) || LABEL.test(l.trim())) || para.length < 15 || !/[。る）]$/.test(para)) continue;
    const at = start + a + 4 + (cut < 0 ? 0 : cut + 2);
    out.push(sheetRecord(input, name, { value: name, raw: nm[0].trim(), at: start + nm.index! + 1 }, { evaluationYear: null, evaluatedFiscalYear: 2024 },
      [{ key: 'purpose', raw: para, at }],
      '北広島町「令和６年度主要施策の概要」の主要施策成果シートの「目的」欄。見出しから「内容（箇条書き）」までの最後の段落が文章で、'
      + 'その直前が決算データのセル（数値・（円）など）か見出しの場合のみ収録。PDFの折り返しの改行を除いた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '北広島町 令和６年度主要施策の概要の主要施策成果シート: 「目的」欄（見出しとの間に決算データのセルが挟まるシートを含む。見出しのないシートは対象外）。',
};
